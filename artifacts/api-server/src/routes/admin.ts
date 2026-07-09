import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { randomUUID } from "node:crypto";
import { db, usersTable, ordersTable, stylesTable, tariffsTable, servicesTable, locationsTable, balancePaymentsTable } from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";
import { z } from "zod";
import { hashPassword, requireAuth } from "../lib/auth";
import { affectedRows } from "../lib/db-result";
import { DEFAULT_STYLE_ASSIST_MODEL, getOpenAIClientCandidates, styleAssistModel, styleAssistProvider } from "../lib/openai";
import { kieCreateChatCompletion, kieCreateNanoBananaProTask, kieGetTask, kieUploadFile } from "../lib/kie";
import { uploadBufferToStorage, downloadStorageObject } from "../lib/storage-helpers";

const router: IRouter = Router();

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

router.use(requireAuth, requireAdmin);

type DashboardPeriod = "7d" | "30d" | "90d" | "year" | "all" | "custom";

interface DashboardRange {
  period: DashboardPeriod;
  from: Date | null;
  to: Date | null;
}

function startOfDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}

function endOfDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(23, 59, 59, 999);
  return out;
}

function parseDate(value: unknown): Date | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseDashboardRange(query: Request["query"]): DashboardRange {
  const period = String(query.period ?? "30d") as DashboardPeriod;
  const now = new Date();
  if (period === "all") return { period: "all", from: null, to: null };
  if (period === "custom") {
    return {
      period: "custom",
      from: parseDate(query.from) ? startOfDay(parseDate(query.from)!) : null,
      to: parseDate(query.to) ? endOfDay(parseDate(query.to)!) : endOfDay(now),
    };
  }
  const days = period === "7d" ? 7 : period === "90d" ? 90 : period === "year" ? 365 : 30;
  const from = startOfDay(new Date(now.getTime() - (days - 1) * 24 * 60 * 60 * 1000));
  return { period: ["7d", "30d", "90d", "year"].includes(period) ? period : "30d", from, to: endOfDay(now) };
}

function dateWhere(column: unknown, range: DashboardRange) {
  if (!range.from && !range.to) return sql`1=1`;
  if (range.from && range.to) return sql`${column} >= ${range.from} and ${column} <= ${range.to}`;
  if (range.from) return sql`${column} >= ${range.from}`;
  return sql`${column} <= ${range.to}`;
}

function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function eachDay(from: Date | null, to: Date | null): string[] {
  if (!from || !to) return [];
  const out: string[] = [];
  const cursor = startOfDay(from);
  const end = startOfDay(to);
  while (cursor <= end && out.length < 370) {
    out.push(dateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

// ---------- Dashboard ----------
router.get("/admin/dashboard", async (req, res) => {
  const range = parseDashboardRange(req.query);
  const orderWhere = dateWhere(ordersTable.createdAt, range);
  const userWhere = dateWhere(usersTable.createdAt, range);
  const paymentWhere = dateWhere(balancePaymentsTable.creditedAt, range);

  const [
    usersTotalRows,
    usersBalanceRows,
    usersNewRows,
    ordersSummaryRows,
    paymentsSummaryRows,
    statusRows,
    topRows,
    dailyOrdersRows,
    dailyPaymentsRows,
    recentRows,
  ] = await Promise.all([
    db.select({ value: sql<number>`count(*)` }).from(usersTable),
    db.select({
      balance: sql<number>`coalesce(sum(${usersTable.balance}),0)`,
      totalSpent: sql<number>`coalesce(sum(${usersTable.totalSpent}),0)`,
    }).from(usersTable),
    db.select({ value: sql<number>`count(*)` }).from(usersTable).where(userWhere),
    db.select({
      total: sql<number>`count(*)`,
      success: sql<number>`coalesce(sum(case when ${ordersTable.status} = 'success' then 1 else 0 end),0)`,
      failed: sql<number>`coalesce(sum(case when ${ordersTable.status} = 'failed' then 1 else 0 end),0)`,
      processing: sql<number>`coalesce(sum(case when ${ordersTable.status} = 'processing' then 1 else 0 end),0)`,
      awaitingApproval: sql<number>`coalesce(sum(case when ${ordersTable.status} = 'awaiting_approval' then 1 else 0 end),0)`,
      grossOrders: sql<number>`coalesce(sum(${ordersTable.amount}),0)`,
      averageOrder: sql<number>`coalesce(avg(nullif(${ordersTable.amount},0)),0)`,
    }).from(ordersTable).where(orderWhere),
    db.select({
      count: sql<number>`count(*)`,
      revenue: sql<number>`coalesce(sum(${balancePaymentsTable.amount}),0)`,
      averagePayment: sql<number>`coalesce(avg(${balancePaymentsTable.amount}),0)`,
    }).from(balancePaymentsTable).where(sql`${paymentWhere} and ${balancePaymentsTable.status} = 'succeeded'`),
    db.select({
      status: ordersTable.status,
      count: sql<number>`count(*)`,
    }).from(ordersTable).where(orderWhere).groupBy(ordersTable.status),
    db.select({
      key: sql<string>`coalesce(${ordersTable.serviceKey}, ${ordersTable.styleId}, 'unknown')`,
      label: sql<string>`coalesce(${servicesTable.title}, ${stylesTable.title}, 'Без категории')`,
      count: sql<number>`count(*)`,
      revenue: sql<number>`coalesce(sum(${ordersTable.amount}),0)`,
      success: sql<number>`coalesce(sum(case when ${ordersTable.status} = 'success' then 1 else 0 end),0)`,
    })
      .from(ordersTable)
      .leftJoin(servicesTable, eq(servicesTable.key, ordersTable.serviceKey))
      .leftJoin(stylesTable, eq(stylesTable.id, ordersTable.styleId))
      .where(orderWhere)
      .groupBy(sql`coalesce(${ordersTable.serviceKey}, ${ordersTable.styleId}, 'unknown')`, sql`coalesce(${servicesTable.title}, ${stylesTable.title}, 'Без категории')`)
      .orderBy(sql`count(*) desc`)
      .limit(8),
    db.select({
      day: sql<string>`date(${ordersTable.createdAt})`,
      orders: sql<number>`count(*)`,
      revenue: sql<number>`coalesce(sum(${ordersTable.amount}),0)`,
      success: sql<number>`coalesce(sum(case when ${ordersTable.status} = 'success' then 1 else 0 end),0)`,
    }).from(ordersTable).where(orderWhere).groupBy(sql`date(${ordersTable.createdAt})`).orderBy(sql`date(${ordersTable.createdAt}) asc`),
    db.select({
      day: sql<string>`date(${balancePaymentsTable.creditedAt})`,
      revenue: sql<number>`coalesce(sum(${balancePaymentsTable.amount}),0)`,
    })
      .from(balancePaymentsTable)
      .where(sql`${paymentWhere} and ${balancePaymentsTable.status} = 'succeeded'`)
      .groupBy(sql`date(${balancePaymentsTable.creditedAt})`)
      .orderBy(sql`date(${balancePaymentsTable.creditedAt}) asc`),
    db.select({
      id: ordersTable.id,
      userEmail: usersTable.email,
      label: sql<string>`coalesce(${servicesTable.title}, ${stylesTable.title}, 'Генерация')`,
      status: ordersTable.status,
      amount: ordersTable.amount,
      createdAt: ordersTable.createdAt,
    })
      .from(ordersTable)
      .leftJoin(usersTable, eq(usersTable.id, ordersTable.userId))
      .leftJoin(servicesTable, eq(servicesTable.key, ordersTable.serviceKey))
      .leftJoin(stylesTable, eq(stylesTable.id, ordersTable.styleId))
      .where(orderWhere)
      .orderBy(desc(ordersTable.createdAt))
      .limit(8),
  ]);

  const orderDaily = new Map(dailyOrdersRows.map((r) => [String(r.day), r]));
  const paymentDaily = new Map(dailyPaymentsRows.map((r) => [String(r.day), r]));
  const days = range.period === "all"
    ? Array.from(new Set([...orderDaily.keys(), ...paymentDaily.keys()])).sort()
    : eachDay(range.from, range.to);

  res.json({
    period: {
      key: range.period,
      from: range.from ? range.from.toISOString() : null,
      to: range.to ? range.to.toISOString() : null,
    },
    summary: {
      usersTotal: Number(usersTotalRows[0]?.value ?? 0),
      usersNew: Number(usersNewRows[0]?.value ?? 0),
      usersBalance: Number(usersBalanceRows[0]?.balance ?? 0),
      usersTotalSpent: Number(usersBalanceRows[0]?.totalSpent ?? 0),
      ordersTotal: Number(ordersSummaryRows[0]?.total ?? 0),
      ordersSuccess: Number(ordersSummaryRows[0]?.success ?? 0),
      ordersFailed: Number(ordersSummaryRows[0]?.failed ?? 0),
      ordersProcessing: Number(ordersSummaryRows[0]?.processing ?? 0),
      ordersAwaitingApproval: Number(ordersSummaryRows[0]?.awaitingApproval ?? 0),
      grossOrders: Number(ordersSummaryRows[0]?.grossOrders ?? 0),
      averageOrder: Number(ordersSummaryRows[0]?.averageOrder ?? 0),
      paymentsCount: Number(paymentsSummaryRows[0]?.count ?? 0),
      paymentsRevenue: Number(paymentsSummaryRows[0]?.revenue ?? 0),
      averagePayment: Number(paymentsSummaryRows[0]?.averagePayment ?? 0),
    },
    statuses: statusRows.map((r) => ({ status: r.status, count: Number(r.count) })),
    topItems: topRows.map((r) => ({
      key: r.key,
      label: r.label,
      count: Number(r.count),
      revenue: Number(r.revenue),
      success: Number(r.success),
    })),
    daily: days.map((day) => ({
      day,
      orders: Number(orderDaily.get(day)?.orders ?? 0),
      success: Number(orderDaily.get(day)?.success ?? 0),
      grossOrders: Number(orderDaily.get(day)?.revenue ?? 0),
      paymentsRevenue: Number(paymentDaily.get(day)?.revenue ?? 0),
    })),
    recentOrders: recentRows.map((o) => ({
      id: o.id,
      userEmail: o.userEmail ?? "",
      label: o.label,
      status: o.status,
      amount: Number(o.amount),
      createdAt: o.createdAt.toISOString(),
    })),
  });
});

// ---------- Users ----------
router.get("/admin/users", async (_req, res) => {
  const rows = await db.select().from(usersTable).orderBy(desc(usersTable.createdAt));
  res.json(
    rows.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name ?? "",
      role: u.role,
      isBlocked: u.isBlocked,
      balance: Number(u.balance),
      totalSpent: Number(u.totalSpent),
      createdAt: u.createdAt.toISOString(),
      lastLogin: u.lastLogin ? u.lastLogin.toISOString() : null,
    })),
  );
});

const UpdateUserSchema = z.object({
  email: z.string().email().optional(),
  name: z.string().optional(),
  password: z.string().min(6).optional(),
  role: z.enum(["user", "admin"]).optional(),
  isBlocked: z.boolean().optional(),
  balance: z.number().nonnegative().optional(),
  totalSpent: z.number().nonnegative().optional(),
});

router.patch("/admin/users/:id", async (req, res) => {
  const parsed = UpdateUserSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.message });
    return;
  }
  const updates: Record<string, unknown> = {};
  const d = parsed.data;
  if (d.email !== undefined) updates.email = d.email;
  if (d.name !== undefined) updates.name = d.name;
  if (d.role !== undefined) updates.role = d.role;
  if (d.isBlocked !== undefined) updates.isBlocked = d.isBlocked;
  if (d.balance !== undefined) updates.balance = d.balance.toFixed(2);
  if (d.totalSpent !== undefined) updates.totalSpent = d.totalSpent.toFixed(2);
  if (d.password) updates.passwordHash = await hashPassword(d.password);

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "Nothing to update" });
    return;
  }
  const result = await db.update(usersTable).set(updates).where(eq(usersTable.id, req.params.id));
  if (affectedRows(result) === 0) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json({ ok: true });
});

router.delete("/admin/users/:id", async (req, res) => {
  if (req.params.id === req.auth!.userId) {
    res.status(400).json({ error: "Cannot delete yourself" });
    return;
  }
  await db.delete(usersTable).where(eq(usersTable.id, req.params.id));
  res.json({ ok: true });
});

// ---------- Orders / Generations ----------
router.get("/admin/orders", async (_req, res) => {
  const rows = await db
    .select({
      id: ordersTable.id,
      userId: ordersTable.userId,
      userEmail: usersTable.email,
      styleId: ordersTable.styleId,
      styleTitle: stylesTable.title,
      serviceKey: ordersTable.serviceKey,
      serviceTitle: servicesTable.title,
      locationName: locationsTable.name,
      status: ordersTable.status,
      amount: ordersTable.amount,
      sourcePhotoUrl: ordersTable.sourcePhotoUrl,
      resultPhotos: ordersTable.resultPhotos,
      createdAt: ordersTable.createdAt,
      completedAt: ordersTable.completedAt,
    })
    .from(ordersTable)
    .leftJoin(usersTable, eq(usersTable.id, ordersTable.userId))
    .leftJoin(stylesTable, eq(stylesTable.id, ordersTable.styleId))
    .leftJoin(servicesTable, eq(servicesTable.key, ordersTable.serviceKey))
    .leftJoin(locationsTable, eq(locationsTable.id, ordersTable.locationId))
    .orderBy(desc(ordersTable.createdAt))
    .limit(500);
  res.json(
    rows.map((o) => ({
      ...o,
      amount: Number(o.amount),
      createdAt: o.createdAt.toISOString(),
      completedAt: o.completedAt ? o.completedAt.toISOString() : null,
    })),
  );
});

// ---------- Tariffs ----------
const TariffSchema = z.object({
  name: z.string().min(1),
  description: z.string().default(""),
  price: z.number().nonnegative(),
  generationsIncluded: z.number().int().positive(),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});

router.get("/admin/tariffs", async (_req, res) => {
  const rows = await db.select().from(tariffsTable).orderBy(tariffsTable.sortOrder);
  res.json(rows.map((t) => ({ ...t, price: Number(t.price), createdAt: t.createdAt.toISOString() })));
});

router.post("/admin/tariffs", async (req, res) => {
  const parsed = TariffSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }
  const id = randomUUID();
  await db.insert(tariffsTable).values({ id, ...parsed.data, price: parsed.data.price.toFixed(2) });
  const [t] = await db.select().from(tariffsTable).where(eq(tariffsTable.id, id)).limit(1);
  res.status(201).json(t);
});

router.patch("/admin/tariffs/:id", async (req, res) => {
  const parsed = TariffSchema.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }
  const updates: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.price !== undefined) updates.price = parsed.data.price.toFixed(2);
  await db.update(tariffsTable).set(updates).where(eq(tariffsTable.id, req.params.id));
  res.json({ ok: true });
});

router.delete("/admin/tariffs/:id", async (req, res) => {
  await db.delete(tariffsTable).where(eq(tariffsTable.id, req.params.id));
  res.json({ ok: true });
});

// ---------- Styles CRUD ----------
const StyleSchema = z.object({
  title: z.string().min(1),
  shortDescription: z.string().min(1),
  fullDescription: z.string().default(""),
  prompt: z.string().default(""),
  category: z.string().min(1),
  price: z.number().nonnegative(),
  previewImageUrl: z.string().min(1),
  referencePhotoUrl: z.string().default(""),
  exampleImages: z.array(z.string()).default([]),
  generationTime: z.number().int().positive().default(60),
  rating: z.number().min(0).max(5).default(4.9),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().optional(),
  ordersCount: z.number().int().nonnegative().default(0),
  photosRequired: z.number().int().min(1).max(3).default(1),
});

router.get("/admin/styles", async (_req, res) => {
  const rows = await db.select().from(stylesTable).orderBy(stylesTable.sortOrder);
  res.json(rows.map((s) => ({ ...s, price: Number(s.price), rating: Number(s.rating), createdAt: s.createdAt.toISOString() })));
});

router.post("/admin/styles", async (req, res) => {
  const parsed = StyleSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input", details: parsed.error.message }); return; }
  const d = parsed.data;
  let sortOrder = d.sortOrder;
  if (sortOrder === undefined) {
    const maxRow = await db.select({ m: sql<number>`coalesce(max(${stylesTable.sortOrder}),0)` }).from(stylesTable);
    sortOrder = Number(maxRow[0]?.m ?? 0) + 1;
  }
  const id = randomUUID();
  await db.insert(stylesTable).values({
    id,
    title: d.title,
    shortDescription: d.shortDescription,
    fullDescription: d.fullDescription,
    prompt: d.prompt,
    category: d.category,
    price: d.price.toFixed(2),
    previewImageUrl: d.previewImageUrl,
    referencePhotoUrl: d.referencePhotoUrl,
    exampleImages: d.exampleImages,
    generationTime: d.generationTime,
    rating: d.rating.toFixed(2),
    isActive: d.isActive,
    sortOrder,
    ordersCount: d.ordersCount,
    photosRequired: d.photosRequired,
  });
  const [s] = await db.select().from(stylesTable).where(eq(stylesTable.id, id)).limit(1);
  res.status(201).json(s);
});

router.patch("/admin/styles/:id", async (req, res) => {
  const parsed = StyleSchema.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }
  const d = parsed.data;
  const updates: Record<string, unknown> = {};
  if (d.title !== undefined) updates.title = d.title;
  if (d.shortDescription !== undefined) updates.shortDescription = d.shortDescription;
  if (d.fullDescription !== undefined) updates.fullDescription = d.fullDescription;
  if (d.prompt !== undefined) updates.prompt = d.prompt;
  if (d.category !== undefined) updates.category = d.category;
  if (d.price !== undefined) updates.price = d.price.toFixed(2);
  if (d.previewImageUrl !== undefined) updates.previewImageUrl = d.previewImageUrl;
  if (d.referencePhotoUrl !== undefined) updates.referencePhotoUrl = d.referencePhotoUrl;
  if (d.exampleImages !== undefined) updates.exampleImages = d.exampleImages;
  if (d.generationTime !== undefined) updates.generationTime = d.generationTime;
  if (d.rating !== undefined) updates.rating = d.rating.toFixed(2);
  if (d.isActive !== undefined) updates.isActive = d.isActive;
  if (d.sortOrder !== undefined) updates.sortOrder = d.sortOrder;
  if (d.ordersCount !== undefined) updates.ordersCount = d.ordersCount;
  if (d.photosRequired !== undefined) updates.photosRequired = d.photosRequired;
  await db.update(stylesTable).set(updates).where(eq(stylesTable.id, req.params.id));
  res.json({ ok: true });
});

router.delete("/admin/styles/:id", async (req, res) => {
  await db.delete(stylesTable).where(eq(stylesTable.id, req.params.id));
  res.json({ ok: true });
});

// ---------- AI assistant for creating styles ----------
const DEFAULT_STYLE_PRICE = 21;

const AssistSchema = z.object({
  idea: z.string().min(3).max(4000),
  referencePhotoUrl: z.string().optional(),
});

const AssistResultSchema = z.object({
  title: z.string().min(1),
  shortDescription: z.string().min(1),
  fullDescription: z.string().min(1),
  category: z.string().min(1),
  prompt: z.string().min(1),
  imagePrompt: z.string().min(1),
});

function extractJsonObject(raw: string): unknown {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error("empty AI response");
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (fenced?.[1]) return JSON.parse(fenced[1]) as unknown;
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(trimmed.slice(start, end + 1)) as unknown;
    throw new Error("AI response did not contain JSON");
  }
}

function aiTextErrorMessage(err: unknown): string {
  const e = err as { status?: number; code?: string; message?: string; error?: { message?: string } };
  const status = e.status;
  if (status === 401 || status === 403) {
    return "OpenRouter/OpenAI отклонил ключ: проверьте, что сохранён действующий OpenRouter API key в разделе «ИИ-модели».";
  }
  if (status === 402) {
    return "На OpenRouter/OpenAI недостаточно баланса для текстовой генерации.";
  }
  if (status === 404) {
    return "Выбранная текстовая модель недоступна. Попробуйте openai/gpt-4o-mini в настройках текстов AI-помощника стилей.";
  }
  if (status === 429) {
    return "OpenRouter/OpenAI временно ограничил запросы или исчерпана квота. Попробуйте позже.";
  }
  const rawMessage = e.error?.message || e.message || "";
  const message = rawMessage.replace(/sk-[A-Za-z0-9_-]+/g, "sk-***").slice(0, 220);
  return message
    ? `Не удалось сгенерировать тексты: ${message}`
    : "Не удалось сгенерировать тексты. Проверьте ключ OpenRouter/OpenAI и попробуйте снова.";
}

function isAuthProviderError(err: unknown): boolean {
  const status = (err as { status?: number })?.status;
  return status === 401 || status === 403;
}

router.post("/admin/styles/assist", async (req, res) => {
  const parsed = AssistSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Опишите идею стиля (минимум 3 символа)" });
    return;
  }
  const idea = parsed.data.idea.trim();
  const referencePhotoUrl = parsed.data.referencePhotoUrl?.trim() ?? "";

  let result: z.infer<typeof AssistResultSchema>;
  try {
    const messages = [
      {
        role: "system" as const,
        content:
          "Ты — ассистент фоторедактора PhotoGen AI. По идее администратора ты придумываешь карточку нового фотостиля. " +
          "Отвечай строго JSON-объектом со следующими полями: " +
          "title (короткое название стиля на русском, 2–4 слова), " +
          "shortDescription (короткое описание на русском, одна строка до 80 символов), " +
          "fullDescription (полное описание на русском, 2–3 предложения, что получит пользователь), " +
          "category (одна категория на русском, например «Деловой», «Творческий», «Гламур»), " +
          "prompt (инструкция на АНГЛИЙСКОМ для модели редактирования изображений Nano Banana Pro — как преобразовать загруженное пользователем фото в этот стиль, сохраняя лицо и черты человека; детально опиши свет, фон, одежду, настроение), " +
          "imagePrompt (отдельный промпт на АНГЛИЙСКОМ для генерации привлекательной обложки-примера этого стиля с фотореалистичным человеком; portrait, high quality). " +
          "Никакого текста кроме JSON.",
      },
      { role: "user" as const, content: idea },
    ];
    const selectedProvider = await styleAssistProvider();
    const selectedModel = await styleAssistModel();
    let raw = "";
    if (selectedProvider === "kie") {
      raw = await kieCreateChatCompletion({
        model: selectedModel.startsWith("kie:") ? selectedModel : "kie:gpt-5-2",
        messages,
        maxCompletionTokens: 1200,
      });
    } else {
      const candidates = await getOpenAIClientCandidates(
        selectedModel.startsWith("kie:") ? DEFAULT_STYLE_ASSIST_MODEL : selectedModel,
      );
      let completion;
      let lastErr: unknown = null;
      for (let i = 0; i < candidates.length; i++) {
        const candidate = candidates[i]!;
        try {
          completion = await candidate.client.chat.completions.create({
            model: candidate.model,
            response_format: { type: "json_object" },
            messages,
            max_completion_tokens: 1200,
          });
          if (i > 0) req.log.info({ source: candidate.source }, "assist text generation succeeded with fallback key");
          break;
        } catch (err) {
          lastErr = err;
          if (!isAuthProviderError(err) || i === candidates.length - 1) throw err;
          req.log.warn({ source: candidate.source }, "assist key rejected; trying fallback key");
        }
      }
      if (!completion) throw lastErr ?? new Error("AI provider returned no completion");
      raw = completion.choices[0]?.message?.content ?? "";
    }
    const json = extractJsonObject(raw);
    const validated = AssistResultSchema.safeParse(json);
    if (!validated.success) {
      req.log.error({ raw }, "assist returned unexpected shape");
      res.status(502).json({ error: "ИИ вернул некорректный ответ, попробуйте ещё раз" });
      return;
    }
    result = validated.data;
  } catch (err) {
    req.log.error({ err }, "assist text generation failed");
    res.status(502).json({ error: aiTextErrorMessage(err) });
    return;
  }

  let imageTaskId: string | null = null;
  try {
    // When the admin supplied a reference photo, generate the preview from it
    // (image-to-image, applying the style's transform prompt). Otherwise fall
    // back to pure text-to-image using the cover prompt.
    let kieImageUrls: string[] = [];
    if (referencePhotoUrl) {
      try {
        const { buffer, contentType } = await downloadStorageObject(referencePhotoUrl);
        const ext = contentType.split("/")[1] ?? "png";
        const kieUrl = await kieUploadFile(buffer, `style-ref.${ext}`, contentType);
        kieImageUrls = [kieUrl];
      } catch (err) {
        req.log.error({ err, referencePhotoUrl }, "assist reference photo upload failed; falling back to text-to-image");
      }
    }
    imageTaskId = await kieCreateNanoBananaProTask({
      prompt: kieImageUrls.length > 0 ? result.prompt : result.imagePrompt,
      imageUrls: kieImageUrls,
      aspectRatio: "3:4",
      resolution: "2K",
    });
  } catch (err) {
    req.log.error({ err }, "assist preview image kickoff failed");
  }

  res.json({
    title: result.title,
    shortDescription: result.shortDescription,
    fullDescription: result.fullDescription,
    category: result.category,
    prompt: result.prompt,
    price: DEFAULT_STYLE_PRICE,
    imageTaskId,
  });
});

router.get("/admin/styles/assist/image/:taskId", async (req, res) => {
  const taskId = String(req.params.taskId ?? "");
  if (!taskId) {
    res.status(400).json({ error: "Invalid taskId" });
    return;
  }
  try {
    const info = await kieGetTask(taskId);
    if (info.state === "success" && info.resultUrls.length > 0) {
      const url = info.resultUrls[0]!;
      let previewImageUrl = url;
      try {
        const ac = new AbortController();
        const t = setTimeout(() => ac.abort(), 60_000);
        const r = await fetch(url, { signal: ac.signal });
        clearTimeout(t);
        if (r.ok) {
          const ct = (r.headers.get("content-type") ?? "image/png").split(";")[0]!.trim();
          const buf = Buffer.from(await r.arrayBuffer());
          previewImageUrl = await uploadBufferToStorage(buf, ct, "previews");
        }
      } catch (err) {
        req.log.error({ err, url }, "assist preview mirror failed; using upstream url");
      }
      res.json({ status: "success", previewImageUrl });
      return;
    }
    if (info.state === "fail") {
      res.json({ status: "failed", error: info.errorMessage ?? "Не удалось сгенерировать изображение" });
      return;
    }
    res.json({ status: "processing" });
  } catch (err) {
    req.log.error({ err, taskId }, "assist image status check failed");
    res.json({ status: "processing" });
  }
});

export default router;
