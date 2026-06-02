---
name: Review (Фото для отзывов) generation flow
description: How the "review" service generates photos — kie.ai sequential chain per set (background job), not n8n.
---

# Review service generation flow

The `review` service ("Фото для отзывов") generates via the model configured for
the `review` category in the admin panel — kie.ai or any OpenRouter image model
(see image-generation-providers.md). It does NOT use n8n (the old `/photos/callback`
endpoint and `N8N_REVIEW_WEBHOOK_URL` / `N8N_CALLBACK_SECRET` secrets are unused).

**Why:** n8n was an external round-trip; the user wanted review photos generated
like styles, billed via kie.ai. Later the user wanted each photo in a set to be a
*pose variation derived from the previous photo*, not independent shots.

**How it works (sequential chain):**
- Each location (`locationsTable.prompts`, jsonb string[]) holds a *pool* of full
  English prompts managed in the admin panel; one is picked at random per photo.
- Photo count = `sets * PHOTOS_PER_SET` (3). Each **set is a sequential chain**:
  photo 1 is generated from the uploaded source, photo 2 from photo 1, photo 3
  from photo 2. Steps after the first append a `POSE_VARIATIONS` directive forcing
  a different pose while keeping same person/outfit/location. Chaining now passes
  the previous step's result *image bytes* (GenImage buffer) as the next step's
  input via `generateImages()`, so it is provider-agnostic (the kie path re-uploads
  the buffer each step internally).
- The whole thing runs in a **background async job** kicked off after the route
  responds `201`. Sets run as concurrent chains (`Promise.all` of `runChain`).
  Each chain swallows its own errors (so `Promise.all` never rejects); the outer
  try/catch only covers the initial seed upload. Results are mirrored to our
  storage and appended to `resultPhotos` incrementally.
- `composeReviewPrompt` substitutes `{item}`/`{age}` or appends them if absent.

**Status endpoint:** for review it NO LONGER polls kie. It just reads DB state
(background job writes `resultPhotos` + final status). A 30-min timeout safety net
finalizes a stuck `processing` order: success if any photos, else fail+refund.

**Concurrency/billing guards:**
- `appendResultPhoto` appends via atomic jsonb `||` AND is guarded on
  `status='processing'`, so a late chain result can never write to an order the
  timeout already failed/refunded.
- kie client calls use `fetchWithTimeout` (upload 120s, createTask 60s,
  recordInfo 30s) so chains can't hang past the safety window.
- Flat per-order price. Refund ONLY when ZERO photos produced; partial = success.
