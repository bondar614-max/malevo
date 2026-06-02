---
name: kie.ai image-to-image input requirement
description: kie.ai Nano Banana Pro image_input needs kie-hosted URLs; our own /api/storage paths won't work.
---

# kie.ai image-to-image needs kie-hosted image URLs

To run image-to-image with kie.ai (Nano Banana Pro `image_input`), the image URLs must be **kie-hosted** — upload the raw bytes via `kieUploadFile()` (returns a kie temp URL, auto-deleted after ~3 days) and pass that.

**Why:** Our own object-storage serving paths (`/api/storage/objects/...`) are relative and not reliably reachable by kie's backend. The existing user `/generate` flow already uploads user photos to kie via `kieUploadFile` rather than passing our storage URLs.

**How to apply:** When you have an image already persisted in our object storage and need it as kie image input (e.g. the admin style-assistant reference photo), read its bytes back with `downloadStorageObject(servingUrl)` (in `storage-helpers.ts`), then `kieUploadFile(buffer, name, contentType)`, then pass the returned URL in `imageUrls`. Empty `imageUrls` = text-to-image; non-empty = image-to-image.
