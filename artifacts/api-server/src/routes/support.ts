import { Router, type IRouter, type NextFunction, type Request, type Response } from "express";
import { randomUUID } from "node:crypto";
import { and, desc, eq, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { db, appSettingsTable, supportTicketsTable, usersTable, type SupportMessage } from "@workspace/db";
import { requireAuth } from "../lib/auth";
import { getOpenAI, supportModel } from "../lib/openai";

const router: IRouter = Router();

const FIRST_QUESTION = "Что случилось, что не так? Опишите ситуацию в двух-трех предложениях.";

const TicketAssistantSchema = z.object({
  reply: z.string().min(1),
  isComplete: z.boolean(),
  topic: z.string().min(1).max(120),
  summary: z.string().min(1).max(2000),
});

function nowMessage(role: SupportMessage["role"], content: string): SupportMessage {
  return { role, content, createdAt: new Date().toISOString() };
}

function serializeTicket(ticket: typeof supportTicketsTable.$inferSelect) {
  return {
    ...ticket,
    createdAt: ticket.createdAt.toISOString(),
    updatedAt: ticket.updatedAt.toISOString(),
  };
}

function fallbackAssistant(messages: SupportMessage[]): z.infer<typeof TicketAssistantSchema> {
  const userMessages = messages.filter((m) => m.role === "user");
  const combined = userMessages.map((m) => m.content).join(" ");
  if (userMessages.length <= 1) {
    return {
      reply: "Понял. Когда это произошло и на какой странице или действии возникла проблема?",
      isComplete: false,
      topic: "Уточнение проблемы",
      summary: combined,
    };
  }
  if (userMessages.length === 2) {
    return {
      reply: "Спасибо. Что вы ожидали получить вместо этого? Если есть ошибка на экране, пришлите ее текст.",
      isComplete: false,
      topic: "Проблема пользователя",
      summary: combined,
    };
  }
  return {
    reply: "Спасибо, я собрал обращение и передал его администратору. Ответ появится после обработки.",
    isComplete: true,
    topic: "Проблема пользователя",
    summary: combined,
  };
}

async function getAssistantReply(messages: SupportMessage[]): Promise<z.infer<typeof TicketAssistantSchema>> {
  const [supportInstructions] = await db
    .select()
    .from(appSettingsTable)
    .where(eq(appSettingsTable.key, "support:instructions"))
    .limit(1);
  const supportContext = supportInstructions?.value.trim()
    ? `\n\nИнструкция и база знаний администратора:\n${supportInstructions.value.trim()}`
    : "";

  try {
    const completion = await (await getOpenAI()).chat.completions.create({
      model: await supportModel(),
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Ты ассистент службы поддержки PhotoGen AI. Собери у пользователя достаточно данных для обращения в админ-панель. " +
            "Задавай по одному короткому уточняющему вопросу. Обычно хватит 2-4 вопросов. " +
            "Когда понятно, что произошло, верни финальный ответ, что обращение передано администратору. " +
            "Отвечай строго JSON: reply, isComplete, topic, summary. topic должен быть короткой темой обращения." +
            supportContext,
        },
        {
          role: "user",
          content: JSON.stringify(messages.map((m) => ({ role: m.role, content: m.content }))),
        },
      ],
      max_completion_tokens: 500,
    });
    const raw = completion.choices[0]?.message?.content ?? "";
    const parsed = TicketAssistantSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : fallbackAssistant(messages);
  } catch {
    return fallbackAssistant(messages);
  }
}

router.post("/support/tickets", requireAuth, async (req, res) => {
  const id = randomUUID();
  await db
    .insert(supportTicketsTable)
    .values({
      id,
      userId: req.auth!.userId,
      messages: [nowMessage("assistant", FIRST_QUESTION)],
    });
  const [ticket] = await db.select().from(supportTicketsTable).where(eq(supportTicketsTable.id, id)).limit(1);
  res.status(201).json(serializeTicket(ticket!));
});

const MessageSchema = z.object({
  message: z.string().trim().min(1).max(4000),
});

router.post("/support/tickets/:id/messages", requireAuth, async (req, res) => {
  const ticketId = String(req.params.id ?? "");
  const parsed = MessageSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Напишите сообщение" });
    return;
  }

  const rows = await db
    .select()
    .from(supportTicketsTable)
    .where(and(eq(supportTicketsTable.id, ticketId), eq(supportTicketsTable.userId, req.auth!.userId)))
    .limit(1);
  const ticket = rows[0];
  if (!ticket) {
    res.status(404).json({ error: "Обращение не найдено" });
    return;
  }
  if (ticket.status !== "collecting") {
    res.status(409).json({ error: "Обращение уже передано администратору" });
    return;
  }

  const withUser = [...ticket.messages, nowMessage("user", parsed.data.message)];
  const assistant = await getAssistantReply(withUser);
  const messages = [...withUser, nowMessage("assistant", assistant.reply)];
  await db
    .update(supportTicketsTable)
    .set({
      messages,
      topic: assistant.topic,
      summary: assistant.summary,
      status: assistant.isComplete ? "open" : "collecting",
      isUnread: assistant.isComplete,
      updatedAt: new Date(),
    })
    .where(eq(supportTicketsTable.id, ticket.id));
  const [updated] = await db.select().from(supportTicketsTable).where(eq(supportTicketsTable.id, ticket.id)).limit(1);
  res.json(serializeTicket(updated!));
});

async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.auth) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const rows = await db.select({ role: usersTable.role }).from(usersTable).where(eq(usersTable.id, req.auth.userId)).limit(1);
  if (rows[0]?.role !== "admin") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  next();
}

router.get("/admin/support/unread-count", requireAuth, requireAdmin, async (_req, res) => {
  const rows = await db
    .select({ count: sql<number>`count(*)` })
    .from(supportTicketsTable)
    .where(eq(supportTicketsTable.isUnread, true));
  res.json({ count: Number(rows[0]?.count ?? 0) });
});

router.get("/admin/support", requireAuth, requireAdmin, async (_req, res) => {
  const rows = await db
    .select({
      id: supportTicketsTable.id,
      userId: supportTicketsTable.userId,
      userEmail: usersTable.email,
      userName: usersTable.name,
      status: supportTicketsTable.status,
      topic: supportTicketsTable.topic,
      summary: supportTicketsTable.summary,
      messages: supportTicketsTable.messages,
      isUnread: supportTicketsTable.isUnread,
      createdAt: supportTicketsTable.createdAt,
      updatedAt: supportTicketsTable.updatedAt,
    })
    .from(supportTicketsTable)
    .leftJoin(usersTable, eq(usersTable.id, supportTicketsTable.userId))
    .where(ne(supportTicketsTable.status, "collecting"))
    .orderBy(desc(supportTicketsTable.updatedAt))
    .limit(500);
  res.json(rows.map((t) => ({ ...t, createdAt: t.createdAt.toISOString(), updatedAt: t.updatedAt.toISOString() })));
});

const AdminUpdateSchema = z.object({
  status: z.enum(["open", "answered", "closed"]).optional(),
  adminReply: z.string().trim().min(1).max(4000).optional(),
  markRead: z.boolean().optional(),
});

router.patch("/admin/support/:id", requireAuth, requireAdmin, async (req, res) => {
  const ticketId = String(req.params.id ?? "");
  const parsed = AdminUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Некорректные данные" });
    return;
  }
  const rows = await db.select().from(supportTicketsTable).where(eq(supportTicketsTable.id, ticketId)).limit(1);
  const ticket = rows[0];
  if (!ticket) {
    res.status(404).json({ error: "Обращение не найдено" });
    return;
  }
  const messages = parsed.data.adminReply
    ? [...ticket.messages, nowMessage("admin", parsed.data.adminReply)]
    : ticket.messages;
  await db
    .update(supportTicketsTable)
    .set({
      messages,
      status: parsed.data.status ?? (parsed.data.adminReply ? "answered" : ticket.status),
      isUnread: parsed.data.markRead === false ? ticket.isUnread : false,
      updatedAt: new Date(),
    })
    .where(eq(supportTicketsTable.id, ticket.id));
  const [updated] = await db.select().from(supportTicketsTable).where(eq(supportTicketsTable.id, ticket.id)).limit(1);
  res.json(serializeTicket(updated!));
});

export default router;
