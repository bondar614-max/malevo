import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db, appSettingsTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { requireAuth } from "../lib/auth";
import {
  listImageModels,
  getAllCategoryModels,
  setCategoryModel,
  type GenCategory,
} from "../lib/imageGen";
import {
  DEFAULT_STYLE_ASSIST_MODEL,
  DEFAULT_STYLE_ASSIST_PROVIDER,
  KIE_TEXT_MODELS,
  listOpenRouterTextModels,
  openRouterHeaders,
} from "../lib/openai";

const router: IRouter = Router();
const EXIT_PROMO_SETTINGS_KEY = "promo:exit_intent";

interface ExitPromoSettings {
  enabled: boolean;
  title: string;
  body: string;
  offer: string;
  couponCode: string;
  buttonText: string;
  buttonUrl: string;
  imageUrl: string;
}

const DEFAULT_EXIT_PROMO_SETTINGS: ExitPromoSettings = {
  enabled: false,
  title: "Не уходите без подарка",
  body: "Попробуйте фотоотзывы бесплатно и посмотрите, как товар выглядит в реальной пользовательской сцене.",
  offer: "Купон на бесплатные генерации фотоотзывов",
  couponCode: "REVIEWFREE",
  buttonText: "Забрать купон",
  buttonUrl: "/photo",
  imageUrl: "",
};

async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.auth) { res.status(401).json({ error: "Unauthorized" }); return; }
  const rows = await db.select({ role: usersTable.role }).from(usersTable).where(eq(usersTable.id, req.auth.userId)).limit(1);
  if (rows[0]?.role !== "admin") { res.status(403).json({ error: "Forbidden" }); return; }
  next();
}

router.get("/admin/ai/models", requireAuth, requireAdmin, async (_req, res) => {
  res.json(await listImageModels());
});

function normalizeExitPromoSettings(value: string | undefined): ExitPromoSettings {
  if (!value) return DEFAULT_EXIT_PROMO_SETTINGS;
  try {
    const parsed = JSON.parse(value) as Partial<ExitPromoSettings>;
    return {
      enabled: Boolean(parsed.enabled),
      title: typeof parsed.title === "string" ? parsed.title : DEFAULT_EXIT_PROMO_SETTINGS.title,
      body: typeof parsed.body === "string" ? parsed.body : DEFAULT_EXIT_PROMO_SETTINGS.body,
      offer: typeof parsed.offer === "string" ? parsed.offer : DEFAULT_EXIT_PROMO_SETTINGS.offer,
      couponCode: typeof parsed.couponCode === "string" ? parsed.couponCode : DEFAULT_EXIT_PROMO_SETTINGS.couponCode,
      buttonText: typeof parsed.buttonText === "string" ? parsed.buttonText : DEFAULT_EXIT_PROMO_SETTINGS.buttonText,
      buttonUrl: typeof parsed.buttonUrl === "string" ? parsed.buttonUrl : DEFAULT_EXIT_PROMO_SETTINGS.buttonUrl,
      imageUrl: typeof parsed.imageUrl === "string" ? parsed.imageUrl : "",
    };
  } catch {
    return DEFAULT_EXIT_PROMO_SETTINGS;
  }
}

async function getExitPromoSettings(): Promise<ExitPromoSettings> {
  const [row] = await db
    .select({ value: appSettingsTable.value })
    .from(appSettingsTable)
    .where(eq(appSettingsTable.key, EXIT_PROMO_SETTINGS_KEY))
    .limit(1);
  return normalizeExitPromoSettings(row?.value);
}

router.get("/promo/exit-intent", async (_req, res) => {
  const settings = await getExitPromoSettings();
  res.json(settings.enabled ? settings : { ...DEFAULT_EXIT_PROMO_SETTINGS, enabled: false });
});

router.get("/admin/promo/exit-intent", requireAuth, requireAdmin, async (_req, res) => {
  res.json(await getExitPromoSettings());
});

const ExitPromoSettingsSchema = z.object({
  enabled: z.boolean(),
  title: z.string().trim().min(1).max(120),
  body: z.string().trim().min(1).max(600),
  offer: z.string().trim().max(200),
  couponCode: z.string().trim().max(64),
  buttonText: z.string().trim().min(1).max(80),
  buttonUrl: z.string().trim().min(1).max(300),
  imageUrl: z.string().trim().max(1000),
});

router.patch("/admin/promo/exit-intent", requireAuth, requireAdmin, async (req, res) => {
  const parsed = ExitPromoSettingsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body", details: parsed.error.message });
    return;
  }
  const settings: ExitPromoSettings = parsed.data;
  await setSetting(EXIT_PROMO_SETTINGS_KEY, JSON.stringify(settings));
  res.json(settings);
});

router.get("/admin/ai/text-models", requireAuth, requireAdmin, async (_req, res) => {
  res.json([...(await listOpenRouterTextModels()), ...KIE_TEXT_MODELS]);
});

router.get("/admin/ai/settings", requireAuth, requireAdmin, async (_req, res) => {
  const models = await getAllCategoryModels();
  const rows = await db
    .select({ value: appSettingsTable.value })
    .from(appSettingsTable)
    .where(eq(appSettingsTable.key, "style_assist:model"));
  const [providerRow] = await db
    .select({ value: appSettingsTable.value })
    .from(appSettingsTable)
    .where(eq(appSettingsTable.key, "style_assist:provider"))
    .limit(1);
  res.json({
    ...models,
    styleAssistProvider: providerRow?.value.trim() || DEFAULT_STYLE_ASSIST_PROVIDER,
    styleAssistModel: rows[0]?.value.trim() || DEFAULT_STYLE_ASSIST_MODEL,
  });
});

function keyCandidates(): Array<{ provider: "openrouter"; source: string; value: string }> {
  const out: Array<{ provider: "openrouter"; source: string; value: string }> = [];
  for (const name of ["OPENROUTER_API_KEY", "OPENAI_API_KEY"]) {
    const value = process.env[name]?.trim() ?? "";
    if (value && !out.some((candidate) => candidate.value === value)) {
      out.push({ provider: "openrouter", source: `env:${name}`, value });
    }
  }
  return out;
}

function keyFingerprint(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length <= 12) return `${trimmed.length} chars`;
  return `${trimmed.slice(0, 7)}...${trimmed.slice(-4)} (${trimmed.length} chars)`;
}

async function checkOpenRouterKey(value: string): Promise<{ ok: boolean; status?: number; message: string }> {
  try {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 20_000);
    const response = await fetch("https://openrouter.ai/api/v1/key", {
      headers: openRouterHeaders(value),
      signal: ac.signal,
    });
    clearTimeout(t);
    const text = await response.text().catch(() => "");
    if (response.ok) return { ok: true, status: response.status, message: "OpenRouter принял ключ" };
    let message = text.slice(0, 220);
    try {
      const json = JSON.parse(text) as { error?: { message?: string }; message?: string };
      message = json.error?.message ?? json.message ?? message;
    } catch { /* keep raw response */ }
    return { ok: false, status: response.status, message: message || response.statusText };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Не удалось проверить ключ" };
  }
}

router.get("/admin/ai/key-diagnostics", requireAuth, requireAdmin, async (_req, res) => {
  const candidates = keyCandidates();
  if (candidates.length === 0) {
    res.json([
      {
        provider: "openrouter",
        source: "none",
        fingerprint: "",
        ok: false,
        message: "Ключ не найден в OPENROUTER_API_KEY или OPENAI_API_KEY",
      },
    ]);
    return;
  }
  const rows = [];
  for (const candidate of candidates) {
    rows.push({
      provider: candidate.provider,
      source: candidate.source,
      fingerprint: keyFingerprint(candidate.value),
      ...(await checkOpenRouterKey(candidate.value)),
    });
  }
  res.json(rows);
});

const SettingsSchema = z.object({
  styles: z.string().min(1).optional(),
  photoshoot: z.string().min(1).optional(),
  review: z.string().min(1).optional(),
  styleAssistProvider: z.enum(["openrouter", "kie"]).optional(),
  styleAssistModel: z.string().min(1).optional(),
});

async function setSetting(key: string, value: string): Promise<void> {
  const [existing] = await db
    .select({ key: appSettingsTable.key })
    .from(appSettingsTable)
    .where(eq(appSettingsTable.key, key))
    .limit(1);
  if (existing) {
    await db.update(appSettingsTable).set({ value, updatedAt: new Date() }).where(eq(appSettingsTable.key, key));
  } else {
    await db.insert(appSettingsTable).values({ key, value, updatedAt: new Date() });
  }
}

router.patch("/admin/ai/settings", requireAuth, requireAdmin, async (req, res) => {
  const parsed = SettingsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const categories: GenCategory[] = ["styles", "photoshoot", "review"];
  for (const c of categories) {
    const v = parsed.data[c];
    if (typeof v === "string") await setCategoryModel(c, v);
  }
  if (typeof parsed.data.styleAssistModel === "string") {
    await setSetting("style_assist:model", parsed.data.styleAssistModel);
  }
  if (typeof parsed.data.styleAssistProvider === "string") {
    await setSetting("style_assist:provider", parsed.data.styleAssistProvider);
  }
  const models = await getAllCategoryModels();
  res.json({
    ...models,
    styleAssistProvider: parsed.data.styleAssistProvider || DEFAULT_STYLE_ASSIST_PROVIDER,
    styleAssistModel: parsed.data.styleAssistModel || DEFAULT_STYLE_ASSIST_MODEL,
  });
});

export default router;
