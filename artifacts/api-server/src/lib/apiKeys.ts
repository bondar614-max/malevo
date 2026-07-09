import { db, appSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export type ApiKeyProvider = "openrouter" | "kie";
export interface ApiKeyCandidate {
  value: string;
  source: "database" | "env";
  name: string;
}

const SETTING_KEYS: Record<ApiKeyProvider, string> = {
  openrouter: "api_key:openrouter",
  kie: "api_key:kie",
};

const ENV_KEYS: Record<ApiKeyProvider, string[]> = {
  openrouter: ["OPENROUTER_API_KEY", "OPENAI_API_KEY"],
  kie: ["KIE_AI_API_KEY"],
};

function normalize(value: string | undefined | null): string {
  return (value ?? "").trim();
}

export async function getApiKey(provider: ApiKeyProvider): Promise<string> {
  const [first] = await getApiKeyCandidates(provider);
  return first?.value ?? "";
}

export async function getApiKeyCandidates(provider: ApiKeyProvider): Promise<ApiKeyCandidate[]> {
  const out: ApiKeyCandidate[] = [];
  const key = SETTING_KEYS[provider];
  const [row] = await db
    .select()
    .from(appSettingsTable)
    .where(eq(appSettingsTable.key, key))
    .limit(1);
  const stored = normalize(row?.value);
  if (stored) out.push({ value: stored, source: "database", name: key });
  for (const envKey of ENV_KEYS[provider]) {
    const envValue = normalize(process.env[envKey]);
    if (envValue && !out.some((candidate) => candidate.value === envValue)) {
      out.push({ value: envValue, source: "env", name: envKey });
    }
  }
  return out;
}

export async function setApiKey(provider: ApiKeyProvider, value: string): Promise<void> {
  const key = SETTING_KEYS[provider];
  await db
    .insert(appSettingsTable)
    .values({ key, value: normalize(value), updatedAt: new Date() })
    .onDuplicateKeyUpdate({
      set: { value: normalize(value), updatedAt: new Date() },
    });
}

export async function getApiKeyStatus(): Promise<Record<ApiKeyProvider, { configured: boolean; source: "database" | "env" | "none" }>> {
  const out: Record<ApiKeyProvider, { configured: boolean; source: "database" | "env" | "none" }> = {
    openrouter: { configured: false, source: "none" as const },
    kie: { configured: false, source: "none" as const },
  };
  for (const provider of Object.keys(SETTING_KEYS) as ApiKeyProvider[]) {
    const key = SETTING_KEYS[provider];
    const [row] = await db
      .select()
      .from(appSettingsTable)
      .where(eq(appSettingsTable.key, key))
      .limit(1);
    if (normalize(row?.value)) {
      out[provider] = { configured: true, source: "database" };
    } else {
      for (const envKey of ENV_KEYS[provider]) {
        if (normalize(process.env[envKey])) {
          out[provider] = { configured: true, source: "env" };
          break;
        }
      }
    }
  }
  return out;
}
