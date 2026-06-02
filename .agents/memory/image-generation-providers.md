---
name: Image generation provider routing
description: How PhotoGen routes image generation between kie.ai and OpenRouter, and the per-category model setting.
---

# Image generation providers

Admin can pick the image model per category (styles / photoshoot / review). Selection
is stored in the `app_settings` key/value table under keys `model:styles`,
`model:photoshoot`, `model:review`. Default for all is `kie:nano-banana-pro`.

**Provider routing is by model-id prefix** (`generateImages` in api-server `lib/imageGen.ts`):
- `kie:*` → kie.ai jobs API (only `kie:nano-banana-pro` supported).
- anything else → treated as a bare OpenRouter model id (e.g. `google/gemini-2.5-flash-image`).

**Why:** the user wanted to choose ANY OpenRouter model, not a hardcoded list. The
admin model dropdown is populated live from `GET https://openrouter.ai/api/v1/models`,
filtered to entries whose `architecture.output_modalities` includes `"image"`. Text-only
models are excluded because they cannot produce images.

**OpenRouter image gen** uses the chat-completions endpoint with `modalities:["image","text"]`;
input photos are sent as `image_url` data URLs, and the result image comes back in
`choices[0].message.images[].image_url.url` (usually a `data:` URL). Aspect ratio is
requested via prompt text (OpenRouter has no aspect_ratio param).

**How to apply:** all three generation flows are now background-driven and DB-status-driven
(like the review chain): the POST handler responds 201 immediately, a background job writes
`resultPhotos` + sets `status`, and `/generate/:orderId/status` just reads DB state with a
30-min timeout safety net. The old kie `taskId`-polling path in the status endpoint was
removed. `kieTaskId` column is now unused for new orders.

**Note:** `OPENAI_API_KEY` is an OpenRouter key (`sk-or-`), reused for both the models list
and image generation.
