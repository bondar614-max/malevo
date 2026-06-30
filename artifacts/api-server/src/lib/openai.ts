import OpenAI from "openai";
import { getApiKey } from "./apiKeys";
import { db, appSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

let client: OpenAI | null = null;
export const DEFAULT_SUPPORT_MODEL = "openai/gpt-4o-mini";

/** OpenRouter keys start with `sk-or-`; they require OpenRouter's base URL. */
function isOpenRouterKey(key: string): boolean {
  return key.startsWith("sk-or-");
}

/** Model id to use for text generation, namespaced for OpenRouter when needed. */
export async function assistModel(): Promise<string> {
  const key = await getApiKey("openrouter");
  return isOpenRouterKey(key) ? "openai/gpt-4o-mini" : "gpt-4o-mini";
}

export async function supportModel(): Promise<string> {
  const [row] = await db
    .select()
    .from(appSettingsTable)
    .where(eq(appSettingsTable.key, "support:model"))
    .limit(1);
  return row?.value.trim() || DEFAULT_SUPPORT_MODEL;
}

export interface TextModelOption {
  id: string;
  name: string;
  provider: "openrouter";
}

export async function listOpenRouterTextModels(): Promise<TextModelOption[]> {
  const fallback: TextModelOption[] = [
    { id: DEFAULT_SUPPORT_MODEL, name: "GPT-4o mini", provider: "openrouter" },
  ];
  const key = await getApiKey("openrouter");
  if (!key) return fallback;
  try {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 30_000);
    const res = await fetch("https://openrouter.ai/api/v1/models", {
      headers: { Authorization: `Bearer ${key}` },
      signal: ac.signal,
    });
    clearTimeout(t);
    if (!res.ok) return fallback;
    const json = (await res.json()) as {
      data?: Array<{ id: string; name?: string; architecture?: { output_modalities?: string[] } }>;
    };
    const models = (json.data ?? [])
      .filter((m) => {
        const out = m.architecture?.output_modalities;
        return !out || out.length === 0 || out.includes("text");
      })
      .map((m) => ({ id: m.id, name: m.name ?? m.id, provider: "openrouter" as const }))
      .sort((a, b) => a.name.localeCompare(b.name));
    return models.some((m) => m.id === DEFAULT_SUPPORT_MODEL) ? models : [...fallback, ...models];
  } catch {
    return fallback;
  }
}

/** Lazily construct the OpenAI-compatible client so the server can boot without the key. */
export async function getOpenAI(): Promise<OpenAI> {
  const key = await getApiKey("openrouter");
  if (!key) throw new Error("OPENAI_API_KEY is not configured");
  return new OpenAI({
    apiKey: key,
    ...(isOpenRouterKey(key) ? { baseURL: "https://openrouter.ai/api/v1" } : {}),
  });
}
