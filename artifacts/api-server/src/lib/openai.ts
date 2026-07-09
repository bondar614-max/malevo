import OpenAI from "openai";
import { db, appSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export const DEFAULT_STYLE_ASSIST_MODEL = "openai/gpt-4o-mini";

/** OpenRouter keys start with `sk-or-`; they require OpenRouter's base URL. */
function isOpenRouterKey(key: string): boolean {
  return key.startsWith("sk-or-");
}

function openAiKeyCandidates(): Array<{ value: string; source: string }> {
  const out: Array<{ value: string; source: string }> = [];
  for (const name of ["OPENROUTER_API_KEY", "OPENAI_API_KEY"]) {
    const value = process.env[name]?.trim() ?? "";
    if (value && !out.some((candidate) => candidate.value === value)) {
      out.push({ value, source: `env:${name}` });
    }
  }
  return out;
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

function modelForKey(model: string, key: string): string {
  if (isOpenRouterKey(key)) return model;
  return model.startsWith("openai/") ? model.slice("openai/".length) : model;
}

export async function styleAssistModel(): Promise<string> {
  const [row] = await db
    .select()
    .from(appSettingsTable)
    .where(eq(appSettingsTable.key, "style_assist:model"))
    .limit(1);
  return row?.value.trim() || DEFAULT_STYLE_ASSIST_MODEL;
}

export interface TextModelOption {
  id: string;
  name: string;
  provider: "openrouter";
}

export async function listOpenRouterTextModels(): Promise<TextModelOption[]> {
  const fallback: TextModelOption[] = [
    { id: DEFAULT_STYLE_ASSIST_MODEL, name: "GPT-4o mini", provider: "openrouter" },
  ];
  const key = openAiKeyCandidates()[0]?.value;
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
    return models.some((m) => m.id === DEFAULT_STYLE_ASSIST_MODEL) ? models : [...fallback, ...models];
  } catch {
    return fallback;
  }
}

export function getOpenAI(): OpenAI {
  const [candidate] = openAiKeyCandidates();
  if (!candidate) throw new Error("OpenRouter/OpenAI API key is not configured");
  return new OpenAI({
    apiKey: candidate.value,
    ...(isOpenRouterKey(candidate.value) ? { baseURL: "https://openrouter.ai/api/v1" } : {}),
    defaultHeaders: isOpenRouterKey(candidate.value) ? openRouterHeaders(candidate.value) : undefined,
  });
}

export interface OpenAIClientCandidate {
  client: OpenAI;
  model: string;
  source: string;
}

export function getOpenAIClientCandidates(model = DEFAULT_STYLE_ASSIST_MODEL): OpenAIClientCandidate[] {
  const candidates = openAiKeyCandidates();
  if (candidates.length === 0) throw new Error("OpenRouter/OpenAI API key is not configured");
  return candidates.map((candidate) => ({
    client: new OpenAI({
      apiKey: candidate.value,
      ...(isOpenRouterKey(candidate.value) ? { baseURL: "https://openrouter.ai/api/v1" } : {}),
      defaultHeaders: isOpenRouterKey(candidate.value) ? openRouterHeaders(candidate.value) : undefined,
    }),
    model: modelForKey(model, candidate.value),
    source: candidate.source,
  }));
}
