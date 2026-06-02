import { Router, type IRouter } from "express";
import multer from "multer";
import { db, ordersTable, stylesTable, usersTable, servicesTable, locationsTable } from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { kieUploadFile, kieCreateNanoBananaProTask, kieGetTask } from "../lib/kie";
import { uploadBufferToStorage } from "../lib/storage-helpers";

const REVIEW_AGES = new Set(["21-30", "30-45", "45+", "random"]);
const MAX_SETS = 10;

/** Public base URL n8n should call back on (prod domain, falling back to dev). */
function publicBaseUrl(): string {
  const fromDomains = process.env["REPLIT_DOMAINS"]?.split(",")[0]?.trim();
  const host = fromDomains || process.env["REPLIT_DEV_DOMAIN"];
  if (!host) throw new Error("Public domain is not configured");
  return `https://${host}`;
}

interface N8nForwardInput {
  generationId: string;
  email: string;
  item: string;
  gender: string;
  age: string;
  location: string;
  locationName: string;
  sets: number;
  photoBase64: string;
  photoName: string;
  photoType: string;
}

/** Forward a review generation request to the external n8n webhook. No retry. */
async function forwardReviewToN8n(input: N8nForwardInput): Promise<void> {
  const webhookUrl = process.env["N8N_REVIEW_WEBHOOK_URL"];
  const secret = process.env["N8N_CALLBACK_SECRET"];
  if (!webhookUrl) throw new Error("N8N_REVIEW_WEBHOOK_URL is not configured");
  if (!secret) throw new Error("N8N_CALLBACK_SECRET is not configured");

  const payload = {
    generation_id: input.generationId,
    email: input.email,
    item: input.item,
    gender: input.gender,
    age: input.age,
    location: input.location,
    location_name: input.locationName,
    sets: input.sets,
    expected_photos: input.sets * 3,
    photo_base64: input.photoBase64,
    photo_name: input.photoName,
    photo_type: input.photoType,
    callback_url: `${publicBaseUrl()}/api/photos/callback`,
    callback_secret: secret,
  };

  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 30_000);
  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: ac.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`n8n webhook responded ${res.status}: ${text.slice(0, 200)}`);
    }
  } finally {
    clearTimeout(t);
  }
}

async function mirrorRemoteImage(url: string, log: { error: (o: object, m?: string) => void }): Promise<string> {
  try {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 60_000);
    const r = await fetch(url, { signal: ac.signal });
    clearTimeout(t);
    if (!r.ok) throw new Error(`fetch ${r.status}`);
    const ct = (r.headers.get("content-type") ?? "image/png").split(";")[0]!.trim();
    const buf = Buffer.from(await r.arrayBuffer());
    return await uploadBufferToStorage(buf, ct, "generated");
  } catch (err) {
    log.error({ err, url }, "mirror failed; using upstream url");
    return url;
  }
}

const router: IRouter = Router();

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES, files: 10 },
});

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ===== Style generation (unchanged behavior) =====
router.post("/generate", requireAuth, upload.array("photos", 3), async (req, res) => {
  try {
    const styleId = String(req.body?.styleId ?? "");
    if (!UUID_RE.test(styleId)) {
      res.status(400).json({ error: "Invalid styleId" });
      return;
    }

    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    if (files.length === 0) {
      res.status(400).json({ error: "No photos uploaded" });
      return;
    }
    for (const f of files) {
      if (!ALLOWED_MIME.has(f.mimetype)) {
        res.status(400).json({ error: `Unsupported file type: ${f.mimetype}` });
        return;
      }
    }

    const [style] = await db.select().from(stylesTable).where(eq(stylesTable.id, styleId)).limit(1);
    if (!style || !style.isActive) {
      res.status(404).json({ error: "Style not found" });
      return;
    }
    if (files.length !== style.photosRequired) {
      res.status(400).json({ error: `Expected ${style.photosRequired} photo(s), got ${files.length}` });
      return;
    }
    if (!style.prompt || style.prompt.trim().length === 0) {
      res.status(400).json({ error: "Стиль ещё не настроен (нет промпта). Обратитесь к администратору." });
      return;
    }

    const userId = req.auth!.userId;
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }
    if (user.isBlocked) { res.status(403).json({ error: "Account blocked" }); return; }
    const price = Number(style.price);

    const debited = await db
      .update(usersTable)
      .set({
        balance: sql`${usersTable.balance} - ${price.toFixed(2)}`,
        totalSpent: sql`${usersTable.totalSpent} + ${price.toFixed(2)}`,
      })
      .where(and(eq(usersTable.id, userId), sql`${usersTable.balance} >= ${price.toFixed(2)}`))
      .returning({ id: usersTable.id });
    if (debited.length === 0) {
      res.status(402).json({ error: "Недостаточно средств на балансе" });
      return;
    }

    const [pendingOrder] = await db
      .insert(ordersTable)
      .values({ userId, styleId, status: "processing", amount: price.toFixed(2), sourcePhotos: [] })
      .returning();
    const orderId = pendingOrder!.id;

    async function refundAndFail(message: string): Promise<void> {
      const transitioned = await db
        .update(ordersTable)
        .set({ status: "failed", errorMessage: message, completedAt: new Date() })
        .where(and(eq(ordersTable.id, orderId), eq(ordersTable.status, "processing")))
        .returning({ id: ordersTable.id });
      if (transitioned.length > 0) {
        await db.update(usersTable).set({
          balance: sql`${usersTable.balance} + ${price.toFixed(2)}`,
          totalSpent: sql`greatest(${usersTable.totalSpent} - ${price.toFixed(2)}, 0)`,
        }).where(eq(usersTable.id, userId));
      }
    }

    try {
      const uploadedUrls: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const f = files[i]!;
        const safeName = `${userId}_${Date.now()}_${i}.${f.mimetype.split("/")[1] ?? "png"}`;
        const url = await kieUploadFile(f.buffer, safeName, f.mimetype);
        uploadedUrls.push(url);
      }

      const taskId = await kieCreateNanoBananaProTask({
        prompt: style.prompt,
        imageUrls: uploadedUrls,
        aspectRatio: "auto",
        resolution: "2K",
      });

      await db
        .update(ordersTable)
        .set({ sourcePhotoUrl: uploadedUrls[0] ?? null, sourcePhotos: uploadedUrls, kieTaskId: taskId })
        .where(eq(ordersTable.id, orderId));

      await db
        .update(stylesTable)
        .set({ ordersCount: sql`${stylesTable.ordersCount} + 1` })
        .where(eq(stylesTable.id, styleId));

      res.status(201).json({ orderId, taskId, status: "processing" });
    } catch (err) {
      req.log.error({ err, orderId }, "generation kickoff failed; refunding");
      await refundAndFail(err instanceof Error ? err.message : "Не удалось запустить генерацию");
      const msg = err instanceof Error ? err.message : "Не удалось запустить генерацию";
      res.status(502).json({ error: msg, refunded: true });
    }
  } catch (err) {
    req.log.error({ err }, "generate failed");
    const msg = err instanceof Error ? err.message : "Generation failed";
    res.status(500).json({ error: msg });
  }
});

// ===== Service generation (WB photoshoot / review) =====
router.post("/generate/service", requireAuth, upload.array("photos", 10), async (req, res) => {
  try {
    const serviceKey = String(req.body?.serviceKey ?? "");
    const locationId = req.body?.locationId ? String(req.body.locationId) : null;

    const [service] = await db.select().from(servicesTable).where(eq(servicesTable.key, serviceKey)).limit(1);
    if (!service || !service.isActive) {
      res.status(404).json({ error: "Услуга не найдена" });
      return;
    }
    if (!service.prompt || service.prompt.trim().length === 0) {
      res.status(400).json({ error: "Услуга ещё не настроена (нет промпта). Обратитесь к администратору." });
      return;
    }

    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    if (files.length < service.photosMin || files.length > service.photosMax) {
      res.status(400).json({
        error: service.photosMin === service.photosMax
          ? `Нужно загрузить ${service.photosMin} фото`
          : `Нужно от ${service.photosMin} до ${service.photosMax} фото`,
      });
      return;
    }
    for (const f of files) {
      if (!ALLOWED_MIME.has(f.mimetype)) {
        res.status(400).json({ error: `Неподдерживаемый формат: ${f.mimetype}` });
        return;
      }
    }

    let locationFragment = "";
    let resolvedLocationId: string | null = null;
    let locationValue = "";
    let locationName = "";
    // Review-only inputs forwarded to n8n.
    let reviewItem = "";
    let reviewGender = "female";
    let reviewAge = "random";
    let reviewSets = 1;
    if (serviceKey === "review") {
      if (!locationId || !UUID_RE.test(locationId)) {
        res.status(400).json({ error: "Выберите локацию" });
        return;
      }
      const [loc] = await db.select().from(locationsTable).where(eq(locationsTable.id, locationId)).limit(1);
      if (!loc || !loc.isActive || loc.serviceKey !== serviceKey) {
        res.status(404).json({ error: "Локация не найдена" });
        return;
      }
      locationFragment = loc.promptFragment;
      locationValue = loc.promptFragment || loc.name;
      locationName = loc.name;
      resolvedLocationId = loc.id;

      reviewItem = String(req.body?.item ?? "").trim();
      if (!reviewItem) {
        res.status(400).json({ error: "Укажите название одежды" });
        return;
      }
      if (reviewItem.length > 255) reviewItem = reviewItem.slice(0, 255);

      reviewGender = String(req.body?.gender ?? "female").trim().toLowerCase();
      if (reviewGender !== "female") {
        res.status(400).json({ error: "Сейчас доступна только женская генерация" });
        return;
      }

      reviewAge = String(req.body?.age ?? "random").trim();
      if (!REVIEW_AGES.has(reviewAge)) {
        res.status(400).json({ error: "Выберите возраст" });
        return;
      }

      reviewSets = Math.floor(Number(req.body?.sets ?? 1));
      if (!Number.isFinite(reviewSets) || reviewSets < 1 || reviewSets > MAX_SETS) {
        res.status(400).json({ error: `Количество комплектов: от 1 до ${MAX_SETS}` });
        return;
      }
    }

    const userId = req.auth!.userId;
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }
    if (user.isBlocked) { res.status(403).json({ error: "Аккаунт заблокирован" }); return; }
    const price = Number(service.price);

    const debited = await db
      .update(usersTable)
      .set({
        balance: sql`${usersTable.balance} - ${price.toFixed(2)}`,
        totalSpent: sql`${usersTable.totalSpent} + ${price.toFixed(2)}`,
      })
      .where(and(eq(usersTable.id, userId), sql`${usersTable.balance} >= ${price.toFixed(2)}`))
      .returning({ id: usersTable.id });
    if (debited.length === 0) {
      res.status(402).json({ error: "Недостаточно средств на балансе" });
      return;
    }

    const isReview = serviceKey === "review";
    const expectedPhotos = isReview ? reviewSets * 3 : 0;

    const [pendingOrder] = await db
      .insert(ordersTable)
      .values({
        userId,
        serviceKey: service.key,
        locationId: resolvedLocationId,
        status: "processing",
        amount: price.toFixed(2),
        sourcePhotos: [],
        ...(isReview
          ? { item: reviewItem, gender: reviewGender, age: reviewAge, sets: reviewSets, expectedPhotos }
          : {}),
      })
      .returning();
    const orderId = pendingOrder!.id;

    async function refundAndFail(message: string): Promise<void> {
      const transitioned = await db
        .update(ordersTable)
        .set({ status: "failed", errorMessage: message, completedAt: new Date() })
        .where(and(eq(ordersTable.id, orderId), eq(ordersTable.status, "processing")))
        .returning({ id: ordersTable.id });
      if (transitioned.length > 0) {
        await db.update(usersTable).set({
          balance: sql`${usersTable.balance} + ${price.toFixed(2)}`,
          totalSpent: sql`greatest(${usersTable.totalSpent} - ${price.toFixed(2)}, 0)`,
        }).where(eq(usersTable.id, userId));
      }
    }

    // ===== Review: forward to n8n (we do NOT generate ourselves) =====
    if (isReview) {
      const f = files[0]!;
      let storedSourceUrl: string;
      try {
        storedSourceUrl = await uploadBufferToStorage(f.buffer, f.mimetype, "source");
      } catch (err) {
        req.log.error({ err, orderId }, "review source upload failed; refunding");
        await refundAndFail("Не удалось сохранить исходное фото");
        res.status(502).json({ error: "Не удалось сохранить исходное фото", refunded: true });
        return;
      }

      try {
        await db
          .update(ordersTable)
          .set({ sourcePhotoUrl: storedSourceUrl, sourcePhotos: [storedSourceUrl] })
          .where(eq(ordersTable.id, orderId));
      } catch (err) {
        req.log.error({ err, orderId }, "review source persist failed; refunding");
        await refundAndFail("Не удалось сохранить исходное фото");
        res.status(502).json({ error: "Не удалось сохранить исходное фото", refunded: true });
        return;
      }

      // Respond immediately; forward to n8n asynchronously (no retry).
      res.status(201).json({ orderId, status: "processing" });

      void (async () => {
        try {
          await forwardReviewToN8n({
            generationId: orderId,
            email: user.email,
            item: reviewItem,
            gender: reviewGender,
            age: reviewAge,
            location: locationValue,
            locationName,
            sets: reviewSets,
            photoBase64: f.buffer.toString("base64"),
            photoName: f.originalname,
            photoType: f.mimetype,
          });
        } catch (err) {
          req.log.error({ err, orderId }, "n8n forward failed; refunding");
          await refundAndFail(err instanceof Error ? err.message : "Не удалось отправить запрос на генерацию");
        }
      })();
      return;
    }

    // ===== Non-review services: existing kie.ai flow =====
    try {
      const uploadedUrls: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const f = files[i]!;
        const safeName = `${userId}_${Date.now()}_${i}.${f.mimetype.split("/")[1] ?? "png"}`;
        const url = await kieUploadFile(f.buffer, safeName, f.mimetype);
        uploadedUrls.push(url);
      }

      const finalPrompt = locationFragment
        ? `${service.prompt} Setting: ${locationFragment}.`
        : service.prompt;

      const taskId = await kieCreateNanoBananaProTask({
        prompt: finalPrompt,
        imageUrls: uploadedUrls,
        aspectRatio: "auto",
        resolution: "2K",
      });

      await db
        .update(ordersTable)
        .set({ sourcePhotoUrl: uploadedUrls[0] ?? null, sourcePhotos: uploadedUrls, kieTaskId: taskId })
        .where(eq(ordersTable.id, orderId));

      res.status(201).json({ orderId, taskId, status: "processing" });
    } catch (err) {
      req.log.error({ err, orderId }, "service generation kickoff failed; refunding");
      await refundAndFail(err instanceof Error ? err.message : "Не удалось запустить генерацию");
      const msg = err instanceof Error ? err.message : "Не удалось запустить генерацию";
      res.status(502).json({ error: msg, refunded: true });
    }
  } catch (err) {
    req.log.error({ err }, "service generate failed");
    const msg = err instanceof Error ? err.message : "Generation failed";
    res.status(500).json({ error: msg });
  }
});

// ===== n8n callback: receives generated review photos one at a time =====
router.post("/photos/callback", async (req, res) => {
  const secret = process.env["N8N_CALLBACK_SECRET"];
  if (!secret) {
    req.log.error("N8N_CALLBACK_SECRET is not configured");
    res.status(503).json({ error: "Callback not configured" });
    return;
  }
  const provided = req.header("x-callback-secret") ?? String(req.body?.callback_secret ?? "");
  if (provided !== secret) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const generationId = String(req.body?.generation_id ?? "");
  if (!UUID_RE.test(generationId)) {
    res.status(400).json({ error: "Invalid generation_id" });
    return;
  }
  const imageUrl = typeof req.body?.image_url === "string" ? req.body.image_url.trim() : "";
  if (!imageUrl) {
    res.status(400).json({ error: "image_url is required" });
    return;
  }
  const rawNumber = req.body?.photo_number;
  const photoNumber =
    rawNumber === undefined || rawNumber === null || rawNumber === ""
      ? null
      : Number(rawNumber);
  if (photoNumber !== null && !Number.isFinite(photoNumber)) {
    res.status(400).json({ error: "Invalid photo_number" });
    return;
  }

  try {
    const result = await db.transaction(async (tx) => {
      const [order] = await tx
        .select()
        .from(ordersTable)
        .where(eq(ordersTable.id, generationId))
        .for("update")
        .limit(1);
      if (!order || order.serviceKey !== "review") {
        return { code: 404 as const };
      }
      if (order.status !== "processing") {
        return { code: 200 as const, status: order.status, received: order.resultPhotos.length };
      }

      const nums = order.receivedPhotoNumbers ?? [];
      if (photoNumber !== null && nums.includes(photoNumber)) {
        return { code: 200 as const, duplicate: true, received: order.resultPhotos.length };
      }

      const mirrored = await mirrorRemoteImage(imageUrl, req.log);
      const newPhotos = [...order.resultPhotos, mirrored];
      const newNums = photoNumber !== null ? [...nums, photoNumber] : nums;
      const expected = order.expectedPhotos > 0 ? order.expectedPhotos : newPhotos.length;
      const done = newPhotos.length >= expected;

      await tx
        .update(ordersTable)
        .set({
          resultPhotos: newPhotos,
          receivedPhotoNumbers: newNums,
          status: done ? "success" : "processing",
          completedAt: done ? new Date() : null,
        })
        .where(eq(ordersTable.id, order.id));

      return { code: 200 as const, received: newPhotos.length, expected, done };
    });

    if (result.code === 404) {
      res.status(404).json({ error: "Order not found" });
      return;
    }
    res.json({ ok: true, ...result });
  } catch (err) {
    req.log.error({ err, generationId }, "n8n callback failed");
    res.status(500).json({ error: "Callback processing failed" });
  }
});

// Auto-fail tasks that have been processing too long.
const STUCK_TASK_MS = 15 * 60 * 1000;

router.get("/generate/:orderId/status", requireAuth, async (req, res) => {
  const orderId = String(req.params.orderId ?? "");
  if (!UUID_RE.test(orderId)) {
    res.status(400).json({ error: "Invalid orderId" });
    return;
  }
  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId)).limit(1);
  if (!order || order.userId !== req.auth!.userId) {
    res.status(404).json({ error: "Order not found" });
    return;
  }

  if (order.status === "success" || order.status === "failed") {
    res.json({
      orderId: order.id,
      status: order.status,
      resultPhotos: order.resultPhotos ?? [],
      errorMessage: order.errorMessage,
    });
    return;
  }

  async function failAndRefund(message: string): Promise<boolean> {
    const transitioned = await db
      .update(ordersTable)
      .set({ status: "failed", errorMessage: message, completedAt: new Date() })
      .where(and(eq(ordersTable.id, order!.id), eq(ordersTable.status, "processing")))
      .returning({ id: ordersTable.id });
    if (transitioned.length === 0) return false;
    if (order!.userId) {
      await db
        .update(usersTable)
        .set({
          balance: sql`${usersTable.balance} + ${order!.amount}`,
          totalSpent: sql`greatest(${usersTable.totalSpent} - ${order!.amount}, 0)`,
        })
        .where(eq(usersTable.id, order!.userId));
    }
    return true;
  }

  const ageMs = Date.now() - order.createdAt.getTime();
  if (ageMs > STUCK_TASK_MS) {
    await failAndRefund("Превышено время ожидания генерации");
    res.json({ orderId: order.id, status: "failed", errorMessage: "Превышено время ожидания генерации", refunded: true });
    return;
  }

  if (!order.kieTaskId) {
    // Review (n8n) orders have no kie task; the callback flips them to success.
    res.json({ orderId: order.id, status: order.status, resultPhotos: order.resultPhotos ?? [] });
    return;
  }

  try {
    const info = await kieGetTask(order.kieTaskId);
    if (info.state === "success" && info.resultUrls.length > 0) {
      const mirrored = await Promise.all(info.resultUrls.map((u) => mirrorRemoteImage(u, req.log)));
      await db
        .update(ordersTable)
        .set({ status: "success", resultPhotos: mirrored, completedAt: new Date() })
        .where(and(eq(ordersTable.id, order.id), eq(ordersTable.status, "processing")));
      res.json({ orderId: order.id, status: "success", resultPhotos: mirrored });
      return;
    }
    if (info.state === "fail") {
      const errMsg = info.errorMessage ?? "Generation failed";
      const didRefund = await failAndRefund(errMsg);
      res.json({ orderId: order.id, status: "failed", errorMessage: errMsg, refunded: didRefund });
      return;
    }
    res.json({ orderId: order.id, status: "processing", resultPhotos: [] });
  } catch (err) {
    req.log.error({ err, taskId: order.kieTaskId }, "kie status check failed");
    res.json({ orderId: order.id, status: "processing", resultPhotos: [] });
  }
});

export default router;
