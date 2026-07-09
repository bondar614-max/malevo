import OpenAI from "openai";
import { getApiKey, getApiKeyCandidates } from "./apiKeys";
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

export interface OpenAIClientCandidate {
  client: OpenAI;
  assistModel: string;
  source: string;
}

export function openRouterHeaders(key: string): Record<string, string> {
  const referer = process.env.PUBLIC_APP_URL?.trim() || "https://malevo.pro";
  return {
    Authorization: `Bearer ${key}`,
    "HTTP-Referer": referer,
    "X-Title": "Malevo",
    "User-Agent": "Malevo/1.0",
  };
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
      headers: openRouterHeaders(key),
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
  if (!key) throw new Error("OpenRouter/OpenAI API key is not configured");
  return new OpenAI({
    apiKey: key,
    ...(isOpenRouterKey(key) ? { baseURL: "https://openrouter.ai/api/v1" } : {}),
    defaultHeaders: isOpenRouterKey(key) ? openRouterHeaders(key) : undefined,
  });
}

export async function getOpenAIClientCandidates(): Promise<OpenAIClientCandidate[]> {
  const keys = await getApiKeyCandidates("openrouter");
  if (keys.length === 0) throw new Error("OpenRouter/OpenAI API key is not configured");
  return keys.map((key) => ({
    client: new OpenAI({
      apiKey: key.value,
      ...(isOpenRouterKey(key.value) ? { baseURL: "https://openrouter.ai/api/v1" } : {}),
      defaultHeaders: isOpenRouterKey(key.value) ? openRouterHeaders(key.value) : undefined,
    }),
    assistModel: isOpenRouterKey(key.value) ? "openai/gpt-4o-mini" : "gpt-4o-mini",
    source: `${key.source}:${key.name}`,
  }));
}
