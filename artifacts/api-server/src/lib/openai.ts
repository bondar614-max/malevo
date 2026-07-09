import OpenAI from "openai";
import { db, appSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export const DEFAULT_STYLE_ASSIST_MODEL = "openai/gpt-4o-mini";
export const DEFAULT_STYLE_ASSIST_PROVIDER = "openrouter";
export type TextProvider = "openrouter" | "kie";

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

export async function styleAssistProvider(): Promise<TextProvider> {
  const [row] = await db
    .select()
    .from(appSettingsTable)
    .where(eq(appSettingsTable.key, "style_assist:provider"))
    .limit(1);
  return row?.value.trim() === "kie" ? "kie" : "openrouter";
}

export interface TextModelOption {
  id: string;
  name: string;
  provider: TextProvider;
}

const OPENROUTER_TEXT_FALLBACK_MODELS: TextModelOption[] = [
  { id: "openai/gpt-4o-mini", name: "OpenAI GPT-4o mini", provider: "openrouter" },
  { id: "openai/gpt-4o", name: "OpenAI GPT-4o", provider: "openrouter" },
  { id: "openai/gpt-5.2", name: "OpenAI GPT-5.2", provider: "openrouter" },
  { id: "openai/gpt-5.1", name: "OpenAI GPT-5.1", provider: "openrouter" },
  { id: "anthropic/claude-sonnet-4.5", name: "Claude Sonnet 4.5", provider: "openrouter" },
  { id: "anthropic/claude-opus-4.5", name: "Claude Opus 4.5", provider: "openrouter" },
  { id: "google/gemini-3-pro", name: "Google Gemini 3 Pro", provider: "openrouter" },
  { id: "google/gemini-2.5-pro", name: "Google Gemini 2.5 Pro", provider: "openrouter" },
  { id: "google/gemini-2.5-flash", name: "Google Gemini 2.5 Flash", provider: "openrouter" },
  { id: "x-ai/grok-4", name: "xAI Grok 4", provider: "openrouter" },
  { id: "deepseek/deepseek-chat", name: "DeepSeek Chat", provider: "openrouter" },
  { id: "deepseek/deepseek-r1", name: "DeepSeek R1", provider: "openrouter" },
  { id: "qwen/qwen3-max", name: "Qwen3 Max", provider: "openrouter" },
  { id: "qwen/qwen3-coder", name: "Qwen3 Coder", provider: "openrouter" },
  { id: "meta-llama/llama-4-maverick", name: "Llama 4 Maverick", provider: "openrouter" },
  { id: "mistralai/mistral-large", name: "Mistral Large", provider: "openrouter" },
];

export const KIE_TEXT_MODELS: TextModelOption[] = [
  { id: "kie:gpt-5-2", name: "GPT-5.2 (KIE)", provider: "kie" },
];

function mergeTextModels(primary: TextModelOption[], fallback: TextModelOption[]): TextModelOption[] {
  const seen = new Set<string>();
  const out: TextModelOption[] = [];
  for (const model of [...primary, ...fallback]) {
    if (seen.has(model.id)) continue;
    seen.add(model.id);
    out.push(model);
  }
  return out;
}

export async function listOpenRouterTextModels(): Promise<TextModelOption[]> {
  const key = openAiKeyCandidates()[0]?.value;
  if (!key) return mergeTextModels([], OPENROUTER_TEXT_FALLBACK_MODELS);
  try {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 30_000);
    const res = await fetch("https://openrouter.ai/api/v1/models", {
      headers: openRouterHeaders(key),
      signal: ac.signal,
    });
    clearTimeout(t);
    if (!res.ok) return mergeTextModels([], OPENROUTER_TEXT_FALLBACK_MODELS);
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
    return mergeTextModels(models, OPENROUTER_TEXT_FALLBACK_MODELS);
  } catch {
    return mergeTextModels([], OPENROUTER_TEXT_FALLBACK_MODELS);
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
