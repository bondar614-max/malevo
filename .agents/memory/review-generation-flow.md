---
name: Review (Фото для отзывов) generation flow
description: How the "review" service generates photos — direct kie.ai fan-out, not n8n.
---

# Review service generation flow

The `review` service ("Фото для отзывов") generates directly via kie.ai, the same
provider as the style/non-review flow. It does NOT use n8n anymore (the old
`/photos/callback` endpoint and `N8N_REVIEW_WEBHOOK_URL` / `N8N_CALLBACK_SECRET`
secrets are unused/removed).

**Why:** the n8n round-trip was an external dependency and a separate billing/flow
path; the user wanted review photos generated the same way as styles, billed via
kie.ai directly.

**How it works:**
- Each location (`locationsTable.prompts`, jsonb string[]) holds a *pool* of full
  English prompts managed by admins in the admin panel. One is picked at random
  per generated photo. Legacy single-field `promptFragment` is only a fallback.
- Photo count = `sets * PHOTOS_PER_SET` (3). One kie task per photo; their ids are
  stored in `ordersTable.kieTaskIds` (jsonb string[]).
- Prompts may contain `{item}` / `{age}` placeholders; `composeReviewPrompt`
  substitutes them, or appends the values if the placeholders are absent.
- Status endpoint polls every kie task OUTSIDE a txn (network), then merges results
  atomically under `SELECT ... FOR UPDATE` to avoid concurrent-poll clobbering.
  `receivedPhotoNumbers` is reused to track finished task *indices*.

**Billing/refund rule:** flat per-order price (not per-photo). Refund only when the
order produces ZERO photos. Partial success (some photos failed) = success, no
refund. The stuck-timeout (30 min) finalizes partial review orders as success.
