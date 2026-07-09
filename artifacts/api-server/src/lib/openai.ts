import OpenAI from "openai";

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

/** Model id to use for text generation, namespaced for OpenRouter when needed. */
export function assistModel(): string {
  const key = openAiKeyCandidates()[0]?.value ?? "";
  return isOpenRouterKey(key) ? "openai/gpt-4o-mini" : "gpt-4o-mini";
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
  assistModel: string;
  source: string;
}

export function getOpenAIClientCandidates(): OpenAIClientCandidate[] {
  const candidates = openAiKeyCandidates();
  if (candidates.length === 0) throw new Error("OpenRouter/OpenAI API key is not configured");
  return candidates.map((candidate) => ({
    client: new OpenAI({
      apiKey: candidate.value,
      ...(isOpenRouterKey(candidate.value) ? { baseURL: "https://openrouter.ai/api/v1" } : {}),
      defaultHeaders: isOpenRouterKey(candidate.value) ? openRouterHeaders(candidate.value) : undefined,
    }),
    assistModel: isOpenRouterKey(candidate.value) ? "openai/gpt-4o-mini" : "gpt-4o-mini",
    source: candidate.source,
  }));
}
