import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import multer from "multer";
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
import { getApiKeyCandidates, getApiKeyStatus, setApiKey, type ApiKeyProvider } from "../lib/apiKeys";
import { DEFAULT_STYLE_ASSIST_MODEL, DEFAULT_SUPPORT_MODEL, listOpenRouterTextModels, openRouterHeaders } from "../lib/openai";

const router: IRouter = Router();
const TRACKING_SETTINGS_KEY = "analytics:tracking";

interface TrackingSettings {
  enabled: boolean;
  yandexMetrikaId: string;
  googleAnalyticsId: string;
  googleTagManagerId: string;
  headCode: string;
  bodyCode: string;
}

const DEFAULT_TRACKING_SETTINGS: TrackingSettings = {
  enabled: false,
  yandexMetrikaId: "",
  googleAnalyticsId: "",
  googleTagManagerId: "",
  headCode: "",
  bodyCode: "",
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

function normalizeTrackingSettings(value: string | undefined): TrackingSettings {
  if (!value) return DEFAULT_TRACKING_SETTINGS;
  try {
    const parsed = JSON.parse(value) as Partial<TrackingSettings>;
    return {
      enabled: Boolean(parsed.enabled),
      yandexMetrikaId: typeof parsed.yandexMetrikaId === "string" ? parsed.yandexMetrikaId : "",
      googleAnalyticsId: typeof parsed.googleAnalyticsId === "string" ? parsed.googleAnalyticsId : "",
      googleTagManagerId: typeof parsed.googleTagManagerId === "string" ? parsed.googleTagManagerId : "",
      headCode: typeof parsed.headCode === "string" ? parsed.headCode : "",
      bodyCode: typeof parsed.bodyCode === "string" ? parsed.bodyCode : "",
    };
  } catch {
    return DEFAULT_TRACKING_SETTINGS;
  }
}

function publicTrackingSettings(settings: TrackingSettings): TrackingSettings {
  return settings.enabled ? settings : DEFAULT_TRACKING_SETTINGS;
}

async function getTrackingSettings(): Promise<TrackingSettings> {
  const [row] = await db
    .select({ value: appSettingsTable.value })
    .from(appSettingsTable)
    .where(eq(appSettingsTable.key, TRACKING_SETTINGS_KEY))
    .limit(1);
  return normalizeTrackingSettings(row?.value);
}

router.get("/analytics/settings", async (_req, res) => {
  res.json(publicTrackingSettings(await getTrackingSettings()));
});

router.get("/admin/analytics/settings", requireAuth, requireAdmin, async (_req, res) => {
  res.json(await getTrackingSettings());
});

const TrackingSettingsSchema = z.object({
  enabled: z.boolean(),
  yandexMetrikaId: z.string().trim().regex(/^\d*$/, "Yandex Metrika ID must contain digits only").max(32),
  googleAnalyticsId: z.string().trim().regex(/^(G-[A-Z0-9]+|UA-\d+-\d+)?$/i, "Invalid Google Analytics ID").max(32),
  googleTagManagerId: z.string().trim().regex(/^(GTM-[A-Z0-9]+)?$/i, "Invalid Google Tag Manager ID").max(32),
  headCode: z.string().max(30000),
  bodyCode: z.string().max(30000),
});

router.patch("/admin/analytics/settings", requireAuth, requireAdmin, async (req, res) => {
  const parsed = TrackingSettingsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body", details: parsed.error.message });
    return;
  }
  const settings: TrackingSettings = parsed.data;
  await db
    .insert(appSettingsTable)
    .values({ key: TRACKING_SETTINGS_KEY, value: JSON.stringify(settings), updatedAt: new Date() })
    .onDuplicateKeyUpdate({
      set: { value: JSON.stringify(settings), updatedAt: new Date() },
    });
  res.json(settings);
});

router.get("/admin/ai/text-models", requireAuth, requireAdmin, async (_req, res) => {
  res.json(await listOpenRouterTextModels());
});

router.get("/admin/ai/settings", requireAuth, requireAdmin, async (_req, res) => {
  const models = await getAllCategoryModels();
  const rows = await db.select().from(appSettingsTable);
  const map = new Map(rows.map((r) => [r.key, r.value] as const));
  res.json({
    ...models,
    styleAssistModel: map.get("style_assist:model") || DEFAULT_STYLE_ASSIST_MODEL,
    supportModel: map.get("support:model") || DEFAULT_SUPPORT_MODEL,
    supportInstructions: map.get("support:instructions") || "",
    supportInstructionFileName: map.get("support:instruction_file_name") || "",
    photoshootApprovalMode: map.get("photoshoot:approval_mode") || "manual",
    photoshootVisionModel: map.get("photoshoot:vision_model") || DEFAULT_SUPPORT_MODEL,
  });
});

router.get("/admin/ai/keys", requireAuth, requireAdmin, async (_req, res) => {
  res.json(await getApiKeyStatus());
});

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
  const providers: ApiKeyProvider[] = ["openrouter", "kie"];
  const rows: Array<{
    provider: ApiKeyProvider;
    source: string;
    fingerprint: string;
    ok: boolean | null;
    status?: number;
    message: string;
  }> = [];

  for (const provider of providers) {
    const candidates = await getApiKeyCandidates(provider);
    if (candidates.length === 0) {
      rows.push({
        provider,
        source: "none",
        fingerprint: "",
        ok: false,
        message: "Ключ не найден ни в базе, ни в env",
      });
      continue;
    }
    for (const candidate of candidates) {
      if (provider === "openrouter") {
        const check = await checkOpenRouterKey(candidate.value);
        rows.push({
          provider,
          source: `${candidate.source}:${candidate.name}`,
          fingerprint: keyFingerprint(candidate.value),
          ...check,
        });
      } else {
        rows.push({
          provider,
          source: `${candidate.source}:${candidate.name}`,
          fingerprint: keyFingerprint(candidate.value),
          ok: null,
          message: "KIE-ключ найден; безопасная онлайн-проверка не выполнялась",
        });
      }
    }
  }

  res.json(rows);
});

const KeysSchema = z.object({
  openrouter: z.string().optional(),
  kie: z.string().optional(),
});

router.patch("/admin/ai/keys", requireAuth, requireAdmin, async (req, res) => {
  const parsed = KeysSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  if (typeof parsed.data.openrouter === "string") {
    await setApiKey("openrouter", parsed.data.openrouter);
  }
  if (typeof parsed.data.kie === "string") {
    await setApiKey("kie", parsed.data.kie);
  }
  res.json(await getApiKeyStatus());
});

const SettingsSchema = z.object({
  styles: z.string().min(1).optional(),
  photoshoot: z.string().min(1).optional(),
  review: z.string().min(1).optional(),
  supportModel: z.string().min(1).optional(),
  styleAssistModel: z.string().min(1).optional(),
  supportInstructions: z.string().max(20000).optional(),
  supportInstructionFileName: z.string().max(255).optional(),
  photoshootApprovalMode: z.enum(["manual", "automatic"]).optional(),
  photoshootVisionModel: z.string().min(1).optional(),
});

async function setSetting(key: string, value: string): Promise<void> {
  await db
    .insert(appSettingsTable)
    .values({ key, value, updatedAt: new Date() })
    .onDuplicateKeyUpdate({
      set: { value, updatedAt: new Date() },
    });
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
  if (typeof parsed.data.supportModel === "string") {
    await setSetting("support:model", parsed.data.supportModel);
  }
  if (typeof parsed.data.styleAssistModel === "string") {
    await setSetting("style_assist:model", parsed.data.styleAssistModel);
  }
  if (typeof parsed.data.supportInstructions === "string") {
    await setSetting("support:instructions", parsed.data.supportInstructions);
  }
  if (typeof parsed.data.supportInstructionFileName === "string") {
    await setSetting("support:instruction_file_name", parsed.data.supportInstructionFileName);
  }
  if (typeof parsed.data.photoshootApprovalMode === "string") {
    await setSetting("photoshoot:approval_mode", parsed.data.photoshootApprovalMode);
  }
  if (typeof parsed.data.photoshootVisionModel === "string") {
    await setSetting("photoshoot:vision_model", parsed.data.photoshootVisionModel);
  }
  const models = await getAllCategoryModels();
  const rows = await db.select().from(appSettingsTable);
  const map = new Map(rows.map((r) => [r.key, r.value] as const));
  res.json({
    ...models,
    styleAssistModel: map.get("style_assist:model") || DEFAULT_STYLE_ASSIST_MODEL,
    supportModel: map.get("support:model") || DEFAULT_SUPPORT_MODEL,
    supportInstructions: map.get("support:instructions") || "",
    supportInstructionFileName: map.get("support:instruction_file_name") || "",
    photoshootApprovalMode: map.get("photoshoot:approval_mode") || "manual",
    photoshootVisionModel: map.get("photoshoot:vision_model") || DEFAULT_SUPPORT_MODEL,
  });
});

const instructionUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
});

async function extractInstructionText(file: Express.Multer.File): Promise<string> {
  const name = file.originalname.toLowerCase();
  const mime = file.mimetype;
  if (
    mime.startsWith("text/") ||
    ["application/json", "application/xml", "text/markdown"].includes(mime) ||
    /\.(txt|md|markdown|json|csv|xml|html?)$/.test(name)
  ) {
    return file.buffer.toString("utf8");
  }
  if (mime === "application/pdf" || name.endsWith(".pdf")) {
    try {
      const { PDFParse } = await import("pdf-parse");
      const parser = new PDFParse({ data: file.buffer });
      try {
        const parsed = await parser.getText();
        return parsed.text ?? "";
      } finally {
        await parser.destroy();
      }
    } catch {
      // Some PDFs have damaged xref tables or unusual encodings. This fallback
      // still recovers plain literal strings from simple instruction PDFs.
      const raw = file.buffer.toString("latin1");
      const chunks = Array.from(raw.matchAll(/\(([^()]{3,})\)/g))
        .map((m) => m[1] ?? "")
        .map((s) => s.replace(/\\([nrtbf()\\])/g, (_all, ch: string) => {
          const map: Record<string, string> = { n: "\n", r: "\r", t: "\t", b: "\b", f: "\f", "(": "(", ")": ")", "\\": "\\" };
          return map[ch] ?? ch;
        }))
        .filter((s) => /[A-Za-zА-Яа-я0-9]/.test(s));
      return chunks.join("\n").trim();
    }
  }
  if (
    mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    name.endsWith(".docx")
  ) {
    const mammoth = await import("mammoth");
    const parsed = await mammoth.extractRawText({ buffer: file.buffer });
    return parsed.value;
  }
  throw new Error("Поддерживаются TXT/MD/JSON/CSV/HTML/PDF/DOCX");
}

router.post(
  "/admin/ai/support-instructions-file",
  requireAuth,
  requireAdmin,
  instructionUpload.single("file"),
  async (req, res) => {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: "Файл не загружен" });
      return;
    }
    try {
      const text = (await extractInstructionText(file)).trim();
      if (!text) {
        res.status(400).json({ error: "Не удалось извлечь текст из файла" });
        return;
      }
      if (text.length > 20000) {
        res.status(400).json({ error: "Инструкция получилась длиннее 20 000 символов" });
        return;
      }
      await setSetting("support:instructions", text);
      await setSetting("support:instruction_file_name", file.originalname);
      res.json({ supportInstructions: text, supportInstructionFileName: file.originalname });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : "Не удалось прочитать файл" });
    }
  },
);

export default router;
