import dns from "node:dns/promises";
import net from "node:net";
import { db, appSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { kieUploadFile, kieCreateNanoBananaProTask, kieGetTask } from "./kie";
import { logger } from "./logger";

export type GenCategory = "styles" | "photoshoot" | "review";

/** Default model: the proven kie.ai Nano Banana Pro. kie models are prefixed `kie:`. */
export const DEFAULT_MODEL = "kie:nano-banana-pro";

const CATEGORY_KEYS: Record<GenCategory, string> = {
  styles: "model:styles",
  photoshoot: "model:photoshoot",
  review: "model:review",
};

export interface GenImage {
  buffer: Buffer;
  mime: string;
}

export type GenProvider = "kie" | "openrouter";

export interface ModelOption {
  id: string;
  name: string;
  provider: GenProvider;
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** fetch with a hard timeout so background generation can never hang indefinitely. */
async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ac.signal });
  } finally {
    clearTimeout(t);
  }
}

// ===== Settings =====

function normalize(v: string | undefined | null): string {
  const t = (v ?? "").trim();
  return t.length > 0 ? t : DEFAULT_MODEL;
}

/** Read the configured model for a category, falling back to the default. */
export async function getCategoryModel(category: GenCategory): Promise<string> {
  const [row] = await db
    .select()
    .from(appSettingsTable)
    .where(eq(appSettingsTable.key, CATEGORY_KEYS[category]))
    .limit(1);
  return normalize(row?.value);
}

/** Read all category models at once for the admin UI. */
export async function getAllCategoryModels(): Promise<Record<GenCategory, string>> {
  const rows = await db.select().from(appSettingsTable);
  const map = new Map(rows.map((r) => [r.key, r.value] as const));
  return {
    styles: normalize(map.get(CATEGORY_KEYS.styles)),
    photoshoot: normalize(map.get(CATEGORY_KEYS.photoshoot)),
    review: normalize(map.get(CATEGORY_KEYS.review)),
  };
}

/** Persist the model selection for a category. */
export async function setCategoryModel(category: GenCategory, model: string): Promise<void> {
  await db
    .insert(appSettingsTable)
    .values({ key: CATEGORY_KEYS[category], value: model })
    .onConflictDoUpdate({
      target: appSettingsTable.key,
      set: { value: model, updatedAt: new Date() },
    });
}

// ===== Model catalogue =====

/**
 * List the selectable image models. Always includes the kie.ai default, then
 * appends every image-output-capable model OpenRouter currently exposes (fetched
 * live, so the admin is never limited to a hardcoded list).
 */
export async function listImageModels(): Promise<ModelOption[]> {
  const out: ModelOption[] = [
    { id: DEFAULT_MODEL, name: "Nano Banana Pro", provider: "kie" },
  ];
  const key = process.env["OPENAI_API_KEY"];
  if (!key) return out;
  try {
    const res = await fetchWithTimeout(
      "https://openrouter.ai/api/v1/models",
      { headers: { Authorization: `Bearer ${key}` } },
      30_000,
    );
    if (!res.ok) {
      logger.error({ status: res.status }, "openrouter models list failed");
      return out;
    }
    const json = (await res.json()) as {
      data?: Array<{ id: string; name?: string; architecture?: { output_modalities?: string[] } }>;
    };
    const models: ModelOption[] = (json.data ?? [])
      .filter((m) => (m.architecture?.output_modalities ?? []).includes("image"))
      .map((m) => ({ id: m.id, name: m.name ?? m.id, provider: "openrouter" as const }))
      .sort((a, b) => a.name.localeCompare(b.name));
    out.push(...models);
  } catch (err) {
    logger.error({ err }, "openrouter models list failed");
  }
  return out;
}

// ===== Generation =====

interface GenerateOpts {
  model: string;
  prompt: string;
  inputs: GenImage[];
  log: { error: (o: object, m?: string) => void };
}

/**
 * Generate one or more images from a prompt and optional input photos using the
 * configured model. Routes `kie:*` models to kie.ai and everything else to
 * OpenRouter. Retries transient failures (errors or empty results) up to
 * `RETRIES` times. Throws the last provider error if every attempt errored, so
 * callers can surface a meaningful message; returns `[]` only if the model ran
 * but produced no image.
 */
const GEN_RETRIES = 2;

export async function generateImages(opts: GenerateOpts): Promise<GenImage[]> {
  const attempt = (): Promise<GenImage[]> =>
    opts.model.startsWith("kie:") ? generateViaKie(opts) : generateViaOpenRouter(opts);

  let lastError: unknown = null;
  for (let i = 0; i <= GEN_RETRIES; i++) {
    try {
      const imgs = await attempt();
      if (imgs.length > 0) return imgs;
      lastError = null; // model ran but returned nothing — retry once more
    } catch (err) {
      lastError = err;
      opts.log.error({ err, model: opts.model, attempt: i + 1 }, "image generation attempt failed");
      // Deterministic client errors (bad model / rejected input) won't change on
      // retry; stop early to avoid wasted calls and log spam (408/429 may recover).
      const status = (err as { status?: number })?.status;
      if (typeof status === "number" && status >= 400 && status < 500 && status !== 408 && status !== 429) {
        throw err;
      }
    }
    if (i < GEN_RETRIES) await sleep(2000);
  }
  if (lastError) throw lastError;
  return [];
}

/** True for IPs in private / loopback / link-local / ULA ranges (SSRF guard). */
function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number) as [number, number];
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true; // link-local
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    return false;
  }
  const lower = ip.toLowerCase();
  if (lower === "::" || lower === "::1") return true;
  if (lower.startsWith("fe80")) return true; // link-local
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // unique local
  const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateIp(mapped[1]!);
  return false;
}

/**
 * Only allow fetching https URLs that resolve to public IPs. Model providers can
 * return arbitrary result URLs, so this blocks SSRF to internal/metadata hosts.
 */
async function isSafeRemoteUrl(raw: string): Promise<boolean> {
  let u: URL;
  try { u = new URL(raw); } catch { return false; }
  if (u.protocol !== "https:") return false;
  const host = u.hostname;
  if (net.isIP(host)) return !isPrivateIp(host);
  try {
    const results = await dns.lookup(host, { all: true });
    return results.length > 0 && results.every((r) => !isPrivateIp(r.address));
  } catch {
    return false;
  }
}

async function fetchImage(url: string): Promise<GenImage | null> {
  if (!(await isSafeRemoteUrl(url))) return null;
  try {
    const r = await fetchWithTimeout(url, {}, 60_000);
    if (!r.ok) return null;
    const mime = (r.headers.get("content-type") ?? "image/png").split(";")[0]!.trim();
    return { buffer: Buffer.from(await r.arrayBuffer()), mime };
  } catch {
    return null;
  }
}

/** Poll a kie task until it succeeds (returns urls), fails or times out (empty). */
async function waitForKieResultUrls(taskId: string): Promise<string[]> {
  const deadline = Date.now() + 8 * 60 * 1000;
  while (Date.now() < deadline) {
    let info;
    try {
      info = await kieGetTask(taskId);
    } catch {
      await sleep(5000);
      continue;
    }
    if (info.state === "success" && info.resultUrls.length > 0) return info.resultUrls;
    if (info.state === "fail") return [];
    await sleep(5000);
  }
  return [];
}

async function generateViaKie(opts: GenerateOpts): Promise<GenImage[]> {
  const kieModel = opts.model.slice("kie:".length);
  if (kieModel !== "nano-banana-pro") {
    throw new Error(`Unsupported kie model: ${kieModel}`);
  }
  const urls: string[] = [];
  for (let i = 0; i < opts.inputs.length; i++) {
    const im = opts.inputs[i]!;
    const ext = im.mime.split("/")[1] ?? "png";
    urls.push(await kieUploadFile(im.buffer, `src_${Date.now()}_${i}.${ext}`, im.mime));
  }
  const taskId = await kieCreateNanoBananaProTask({
    prompt: opts.prompt,
    imageUrls: urls,
    aspectRatio: "3:4",
    resolution: "2K",
  });
  const resultUrls = await waitForKieResultUrls(taskId);
  const out: GenImage[] = [];
  for (const u of resultUrls) {
    const img = await fetchImage(u);
    if (img) out.push(img);
  }
  return out;
}

type ORContent =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

async function generateViaOpenRouter(opts: GenerateOpts): Promise<GenImage[]> {
  const key = process.env["OPENAI_API_KEY"];
  if (!key) throw new Error("OPENAI_API_KEY is not configured");

  const content: ORContent[] = [
    {
      type: "text",
      text: `${opts.prompt}\n\nReturn a single photorealistic portrait image with a 3:4 (vertical) aspect ratio.`,
    },
  ];
  for (const im of opts.inputs) {
    content.push({
      type: "image_url",
      image_url: { url: `data:${im.mime};base64,${im.buffer.toString("base64")}` },
    });
  }

  const res = await fetchWithTimeout(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: opts.model,
        messages: [{ role: "user", content }],
        modalities: ["image", "text"],
      }),
    },
    180_000,
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const err = new Error(`openrouter image failed: ${res.status} ${text.slice(0, 200)}`) as Error & {
      status?: number;
    };
    err.status = res.status;
    throw err;
  }

  const json = (await res.json()) as {
    choices?: Array<{ message?: { images?: Array<{ image_url?: { url?: string }; url?: string }> } }>;
  };
  const images = json.choices?.[0]?.message?.images ?? [];
  if (images.length === 0) {
    opts.log.error(
      { model: opts.model, finishReason: (json as { choices?: Array<{ finish_reason?: string }> }).choices?.[0]?.finish_reason },
      "openrouter returned no image (model may not support image output for this input)",
    );
  }
  const out: GenImage[] = [];
  for (const img of images) {
    const url = img.image_url?.url ?? img.url;
    if (typeof url !== "string") continue;
    if (url.startsWith("data:")) {
      const comma = url.indexOf(",");
      if (comma === -1) continue;
      const meta = url.slice(5, comma); // e.g. image/png;base64
      const mime = (meta.split(";")[0] || "image/png").trim();
      out.push({ buffer: Buffer.from(url.slice(comma + 1), "base64"), mime });
    } else {
      const fetched = await fetchImage(url);
      if (fetched) out.push(fetched);
    }
  }
  return out;
}
