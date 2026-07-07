import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { randomUUID } from "node:crypto";
import { db, appSettingsTable, balancePaymentsTable, usersTable } from "@workspace/db";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { requireAuth } from "../lib/auth";
import { affectedRows } from "../lib/db-result";

const router: IRouter = Router();
const YOOKASSA_API = "https://api.yookassa.ru/v3";

interface YooKassaSettings {
  enabled: boolean;
  shopId: string;
  secretKey: string;
  returnUrl: string;
  webhookToken: string;
}

interface YooKassaPayment {
  id: string;
  status: string;
  paid?: boolean;
  amount?: { value?: string; currency?: string };
  confirmation?: { confirmation_url?: string };
  metadata?: Record<string, unknown>;
}

const PUBLIC_SETTINGS_KEYS = {
  enabled: "payments:yookassa:enabled",
  shopId: "payments:yookassa:shop_id",
  secretKey: "payments:yookassa:secret_key",
  returnUrl: "payments:yookassa:return_url",
  webhookToken: "payments:yookassa:webhook_token",
} as const;

function normalize(value: unknown): string {
  return String(value ?? "").trim();
}

async function setSetting(key: string, value: string): Promise<void> {
  await db
    .insert(appSettingsTable)
    .values({ key, value, updatedAt: new Date() })
    .onDuplicateKeyUpdate({ set: { value, updatedAt: new Date() } });
}

async function getYooKassaSettings(): Promise<YooKassaSettings> {
  const rows = await db.select().from(appSettingsTable);
  const map = new Map(rows.map((r) => [r.key, r.value] as const));
  return {
    enabled: map.get(PUBLIC_SETTINGS_KEYS.enabled) === "true",
    shopId: normalize(map.get(PUBLIC_SETTINGS_KEYS.shopId) || process.env.YOOKASSA_SHOP_ID),
    secretKey: normalize(map.get(PUBLIC_SETTINGS_KEYS.secretKey) || process.env.YOOKASSA_SECRET_KEY),
    returnUrl: normalize(map.get(PUBLIC_SETTINGS_KEYS.returnUrl) || process.env.PUBLIC_APP_URL),
    webhookToken: normalize(map.get(PUBLIC_SETTINGS_KEYS.webhookToken) || process.env.YOOKASSA_WEBHOOK_TOKEN),
  };
}

function authHeader(settings: YooKassaSettings): string {
  return `Basic ${Buffer.from(`${settings.shopId}:${settings.secretKey}`).toString("base64")}`;
}

async function yookassaFetch<T>(
  settings: YooKassaSettings,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${YOOKASSA_API}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader(settings),
      ...(init.headers as Record<string, string> | undefined),
    },
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const message = data?.description || data?.error_description || data?.message || `ЮKassa вернула ${res.status}`;
    throw new Error(message);
  }
  return data as T;
}

function absoluteReturnUrl(req: Request, settings: YooKassaSettings, paymentId: string): string {
  const configured = settings.returnUrl.trim();
  const base = configured || req.get("origin") || `${req.protocol}://${req.get("host")}`;
  const url = new URL(base);
  if (!configured || url.pathname === "/" || url.pathname === "") {
    url.pathname = "/account";
  }
  url.searchParams.set("payment", paymentId);
  return url.toString();
}

async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.auth) { res.status(401).json({ error: "Unauthorized" }); return; }
  const rows = await db.select({ role: usersTable.role }).from(usersTable).where(eq(usersTable.id, req.auth.userId)).limit(1);
  if (rows[0]?.role !== "admin") { res.status(403).json({ error: "Forbidden" }); return; }
  next();
}

const TopUpSchema = z.object({
  amount: z.coerce.number().min(10).max(500000),
});

router.post("/payments/top-up", requireAuth, async (req, res) => {
  const parsed = TopUpSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Укажите сумму от 10 до 500000 ₽" });
    return;
  }

  const settings = await getYooKassaSettings();
  if (!settings.enabled || !settings.shopId || !settings.secretKey) {
    res.status(400).json({ error: "Пополнение баланса временно не настроено" });
    return;
  }

  const userId = req.auth!.userId;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }
  if (user.isBlocked) { res.status(403).json({ error: "Аккаунт заблокирован" }); return; }

  const amount = parsed.data.amount.toFixed(2);
  const paymentId = randomUUID();
  const description = `Пополнение баланса ${user.email}`;
  await db.insert(balancePaymentsTable).values({
    id: paymentId,
    userId,
    status: "pending",
    amount,
    currency: "RUB",
    description,
    updatedAt: new Date(),
  });

  try {
    const payment = await yookassaFetch<YooKassaPayment>(settings, "/payments", {
      method: "POST",
      headers: { "Idempotence-Key": paymentId },
      body: JSON.stringify({
        amount: { value: amount, currency: "RUB" },
        capture: true,
        confirmation: { type: "redirect", return_url: absoluteReturnUrl(req, settings, paymentId) },
        description,
        metadata: { balancePaymentId: paymentId, userId },
      }),
    });
    const confirmationUrl = payment.confirmation?.confirmation_url ?? "";
    await db
      .update(balancePaymentsTable)
      .set({
        yookassaPaymentId: payment.id,
        status: payment.status || "pending",
        confirmationUrl,
        updatedAt: new Date(),
      })
      .where(eq(balancePaymentsTable.id, paymentId));
    res.status(201).json({ paymentId, confirmationUrl, status: payment.status });
  } catch (err) {
    await db
      .update(balancePaymentsTable)
      .set({ status: "failed", updatedAt: new Date() })
      .where(eq(balancePaymentsTable.id, paymentId));
    req.log.error({ err, paymentId }, "yookassa payment create failed");
    res.status(502).json({ error: err instanceof Error ? err.message : "Не удалось создать платеж" });
  }
});

router.get("/payments", requireAuth, async (req, res) => {
  const rows = await db
    .select()
    .from(balancePaymentsTable)
    .where(eq(balancePaymentsTable.userId, req.auth!.userId))
    .orderBy(desc(balancePaymentsTable.createdAt))
    .limit(50);
  res.json(rows.map((p) => ({
    id: p.id,
    yookassaPaymentId: p.yookassaPaymentId,
    status: p.status,
    amount: Number(p.amount),
    currency: p.currency,
    confirmationUrl: p.confirmationUrl,
    createdAt: p.createdAt.toISOString(),
    creditedAt: p.creditedAt ? p.creditedAt.toISOString() : null,
  })));
});

async function creditPayment(yookassaPaymentId: string, req: Request): Promise<void> {
  const settings = await getYooKassaSettings();
  if (!settings.shopId || !settings.secretKey) throw new Error("YooKassa keys are not configured");

  const remote = await yookassaFetch<YooKassaPayment>(settings, `/payments/${encodeURIComponent(yookassaPaymentId)}`);
  if (remote.status !== "succeeded" || remote.paid !== true) return;

  const [local] = await db
    .select()
    .from(balancePaymentsTable)
    .where(eq(balancePaymentsTable.yookassaPaymentId, yookassaPaymentId))
    .limit(1);
  if (!local) {
    req.log.warn({ yookassaPaymentId }, "successful yookassa payment not found locally");
    return;
  }

  const remoteAmount = Number(remote.amount?.value ?? 0).toFixed(2);
  if (remote.amount?.currency !== "RUB" || remoteAmount !== Number(local.amount).toFixed(2)) {
    req.log.error({ yookassaPaymentId, localAmount: local.amount, remoteAmount: remote.amount }, "yookassa amount mismatch");
    await db.update(balancePaymentsTable).set({ status: "amount_mismatch", updatedAt: new Date() }).where(eq(balancePaymentsTable.id, local.id));
    return;
  }

  const marked = await db
    .update(balancePaymentsTable)
    .set({ status: "succeeded", creditedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(balancePaymentsTable.id, local.id), isNull(balancePaymentsTable.creditedAt)));
  if (affectedRows(marked) === 0) return;

  await db
    .update(usersTable)
    .set({ balance: sql`${usersTable.balance} + ${Number(local.amount).toFixed(2)}` })
    .where(eq(usersTable.id, local.userId));
}

router.post("/payments/yookassa/webhook", async (req, res) => {
  try {
    const settings = await getYooKassaSettings();
    if (settings.webhookToken && req.query.token !== settings.webhookToken) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    const event = String(req.body?.event ?? "");
    const paymentId = normalize(req.body?.object?.id);
    if (event === "payment.succeeded" && paymentId) {
      await creditPayment(paymentId, req);
    } else if (event === "payment.canceled" && paymentId) {
      await db
        .update(balancePaymentsTable)
        .set({ status: "canceled", updatedAt: new Date() })
        .where(and(eq(balancePaymentsTable.yookassaPaymentId, paymentId), isNull(balancePaymentsTable.creditedAt)));
    }
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "yookassa webhook failed");
    res.status(500).json({ error: "Webhook processing failed" });
  }
});

router.get("/admin/payments/yookassa", requireAuth, requireAdmin, async (_req, res) => {
  const settings = await getYooKassaSettings();
  res.json({
    enabled: settings.enabled,
    shopId: settings.shopId,
    secretConfigured: Boolean(settings.secretKey),
    returnUrl: settings.returnUrl,
    webhookToken: settings.webhookToken,
  });
});

const AdminYooKassaSettingsSchema = z.object({
  enabled: z.boolean(),
  shopId: z.string().trim().max(255),
  secretKey: z.string().trim().max(255).optional(),
  returnUrl: z.string().trim().max(1000),
  webhookToken: z.string().trim().max(255).optional(),
});

router.patch("/admin/payments/yookassa", requireAuth, requireAdmin, async (req, res) => {
  const parsed = AdminYooKassaSettingsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body", details: parsed.error.message });
    return;
  }
  const d = parsed.data;
  await setSetting(PUBLIC_SETTINGS_KEYS.enabled, d.enabled ? "true" : "false");
  await setSetting(PUBLIC_SETTINGS_KEYS.shopId, d.shopId);
  await setSetting(PUBLIC_SETTINGS_KEYS.returnUrl, d.returnUrl);
  if (typeof d.secretKey === "string" && d.secretKey.trim()) {
    await setSetting(PUBLIC_SETTINGS_KEYS.secretKey, d.secretKey.trim());
  }
  if (typeof d.webhookToken === "string") {
    await setSetting(PUBLIC_SETTINGS_KEYS.webhookToken, d.webhookToken.trim());
  }
  const updated = await getYooKassaSettings();
  res.json({
    enabled: updated.enabled,
    shopId: updated.shopId,
    secretConfigured: Boolean(updated.secretKey),
    returnUrl: updated.returnUrl,
    webhookToken: updated.webhookToken,
  });
});

router.get("/admin/payments", requireAuth, requireAdmin, async (_req, res) => {
  const rows = await db
    .select({
      id: balancePaymentsTable.id,
      userId: balancePaymentsTable.userId,
      userEmail: usersTable.email,
      yookassaPaymentId: balancePaymentsTable.yookassaPaymentId,
      status: balancePaymentsTable.status,
      amount: balancePaymentsTable.amount,
      currency: balancePaymentsTable.currency,
      confirmationUrl: balancePaymentsTable.confirmationUrl,
      createdAt: balancePaymentsTable.createdAt,
      creditedAt: balancePaymentsTable.creditedAt,
    })
    .from(balancePaymentsTable)
    .leftJoin(usersTable, eq(usersTable.id, balancePaymentsTable.userId))
    .orderBy(desc(balancePaymentsTable.createdAt))
    .limit(500);
  res.json(rows.map((p) => ({
    ...p,
    amount: Number(p.amount),
    createdAt: p.createdAt.toISOString(),
    creditedAt: p.creditedAt ? p.creditedAt.toISOString() : null,
  })));
});

export default router;
