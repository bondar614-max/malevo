---
name: OpenAI/OpenRouter key handling
description: The project's OPENAI_API_KEY secret is actually an OpenRouter key; client must switch base URL + model namespace.
---

# OPENAI_API_KEY is an OpenRouter key

The secret named `OPENAI_API_KEY` in this project holds an **OpenRouter** key (prefix `sk-or-`), not a direct OpenAI key.

**Why:** The user declined the Replit-managed OpenAI integration and pasted their own key, which turned out to be an OpenRouter key. A direct `new OpenAI({ apiKey })` call returns `401 Incorrect API key` because it hits `api.openai.com`.

**How to apply:** The OpenAI-compatible client (`artifacts/api-server/src/lib/openai.ts`) detects the `sk-or-` prefix and, when present, sets `baseURL: "https://openrouter.ai/api/v1"` and namespaces model ids (e.g. `openai/gpt-4o-mini` instead of `gpt-4o-mini`). If the user later swaps in a real OpenAI key, the same code falls back to the default OpenAI base URL and bare model names automatically. Don't hardcode a single base URL or model name.
