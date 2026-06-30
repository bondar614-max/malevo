import { db, appSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export type ApiKeyProvider = "openrouter" | "kie";

const SETTING_KEYS: Record<ApiKeyProvider, string> = {
  openrouter: "api_key:openrouter",
  kie: "api_key:kie",
};

const ENV_KEYS: Record<ApiKeyProvider, string> = {
  openrouter: "OPENAI_API_KEY",
  kie: "KIE_AI_API_KEY",
};

function normalize(value: string | undefined | null): string {
  return (value ?? "").trim();
}

export async function getApiKey(provider: ApiKeyProvider): Promise<string> {
  const key = SETTING_KEYS[provider];
  const [row] = await db
    .select()
    .from(appSettingsTable)
    .where(eq(appSettingsTable.key, key))
    .limit(1);
  const stored = normalize(row?.value);
  if (stored) return stored;
  return normalize(process.env[ENV_KEYS[provider]]);
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
    } else if (normalize(process.env[ENV_KEYS[provider]])) {
      out[provider] = { configured: true, source: "env" };
    }
  }
  return out;
}
