import OpenAI from "openai";

let client: OpenAI | null = null;

/** OpenRouter keys start with `sk-or-`; they require OpenRouter's base URL. */
function isOpenRouterKey(key: string): boolean {
  return key.startsWith("sk-or-");
}

/** Model id to use for text generation, namespaced for OpenRouter when needed. */
export function assistModel(): string {
  const key = process.env["OPENAI_API_KEY"] ?? "";
  return isOpenRouterKey(key) ? "openai/gpt-4o-mini" : "gpt-4o-mini";
}

/** Lazily construct the OpenAI-compatible client so the server can boot without the key. */
export function getOpenAI(): OpenAI {
  const key = process.env["OPENAI_API_KEY"];
  if (!key) throw new Error("OPENAI_API_KEY is not configured");
  if (!client) {
    client = new OpenAI({
      apiKey: key,
      ...(isOpenRouterKey(key) ? { baseURL: "https://openrouter.ai/api/v1" } : {}),
    });
  }
  return client;
}
