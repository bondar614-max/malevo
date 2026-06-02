import { Router, type IRouter } from "express";
import multer from "multer";
import { db, ordersTable, stylesTable, usersTable, servicesTable, locationsTable } from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { kieUploadFile, kieCreateNanoBananaProTask, kieGetTask } from "../lib/kie";
import { uploadBufferToStorage } from "../lib/storage-helpers";

const REVIEW_AGES = new Set(["21-30", "30-45", "45+", "random"]);
const MAX_SETS = 10;
const PHOTOS_PER_SET = 3;

const AGE_LABELS: Record<string, string> = {
  "21-30": "21-30 years old",
  "30-45": "30-45 years old",
  "45+": "45+ years old",
};

/** Pick a random element from a non-empty array. */
function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

/**
 * Build the final kie.ai prompt for one review photo. The location prompt may
 * contain {item} / {age} placeholders; if it does not, those values are
 * appended automatically. The service base prompt is prepended.
 */
function composeReviewPrompt(basePrompt: string, locationPrompt: string, item: string, age: string): string {
  const ageText = age && age !== "random" ? (AGE_LABELS[age] ?? age) : "";
  const hasItem = locationPrompt.includes("{item}");
  const hasAge = locationPrompt.includes("{age}");
  let p = locationPrompt.replaceAll("{item}", item).replaceAll("{age}", ageText);
  const extras: string[] = [];
  if (!hasItem && item) extras.push(`Clothing/item: ${item}.`);
  if (!hasAge && ageText) extras.push(`Age: ${ageText}.`);
  return [basePrompt.trim(), p.trim(), ...extras].filter(Boolean).join(" ").trim();
}

// Pose directives appended on each chained step so every subsequent photo shows
// a clearly different pose while keeping the same person, outfit and location.
const POSE_VARIATIONS = [
  "Keep the exact same person, same face, same outfit and the same location as in the reference image, but change to a clearly DIFFERENT pose: different body angle, different position of arms and hands, different head tilt and a slightly different facial expression. Natural, candid amateur smartphone shot.",
  "Same person, same face, same outfit and same place as the reference image, but use yet another DIFFERENT pose and camera angle: shift the stance and weight, reposition the arms, change the framing. Natural, candid amateur smartphone shot.",
  "Same person, same face, same clothing and same setting as the reference image, but show a new DISTINCT pose: different gesture, different angle and different expression from before. Natural, candid amateur smartphone shot.",
];

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** Poll a kie task until it succeeds (returns first url), fails (null) or times out (null). */
async function waitForKieResult(taskId: string): Promise<string | null> {
  const deadline = Date.now() + 8 * 60 * 1000;
  while (Date.now() < deadline) {
    let info;
    try {
      info = await kieGetTask(taskId);
    } catch {
      await sleep(5000);
      continue;
    }
    if (info.state === "success" && info.resultUrls.length > 0) return info.resultUrls[0]!;
    if (info.state === "fail") return null;
    await sleep(5000);
  }
  return null;
}

/**
 * Atomically append one url to an order's resultPhotos jsonb array (safe under
 * concurrency). Guarded on status='processing' so a late chain result can never
 * be written to an order the timeout safety net already failed/refunded.
 */
async function appendResultPhoto(orderId: string, url: string): Promise<void> {
  await db
    .update(ordersTable)
    .set({ resultPhotos: sql`${ordersTable.resultPhotos} || ${JSON.stringify([url])}::jsonb` })
    .where(and(eq(ordersTable.id, orderId), eq(ordersTable.status, "processing")));
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
    // Review-only inputs.
    let reviewItem = "";
    let reviewGender = "female";
    let reviewAge = "random";
    let reviewSets = 1;
    let reviewPromptPool: string[] = [];
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
      resolvedLocationId = loc.id;
      // Build the pool of prompts to choose from per photo. Prefer the new
      // multi-prompt list; fall back to the legacy single fragment.
      const listed = (loc.prompts ?? []).map((p) => p.trim()).filter(Boolean);
      reviewPromptPool = listed.length > 0
        ? listed
        : (loc.promptFragment.trim() ? [loc.promptFragment.trim()] : []);
      if (reviewPromptPool.length === 0) {
        res.status(400).json({ error: "Для этой локации не настроены промпты. Обратитесь к администратору." });
        return;
      }

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
    const expectedPhotos = isReview ? reviewSets * PHOTOS_PER_SET : 0;

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

    // ===== Review: generate via kie.ai as a sequential chain per set =====
    // Each set is a chain of PHOTOS_PER_SET photos: photo 1 is generated from the
    // uploaded source, photo 2 from photo 1, photo 3 from photo 2 — each step
    // forcing a clearly different pose. Sets run as independent concurrent chains.
    if (isReview) {
      // Snapshot buffers/metadata for the async kickoff (multer memory storage).
      const reviewFiles = files.map((f) => ({ buffer: f.buffer, mimetype: f.mimetype }));

      // Respond immediately; run the chains in the background.
      res.status(201).json({ orderId, status: "processing" });

      void (async () => {
        try {
          // Upload the source photo(s) to kie once; reuse as the seed for every chain.
          const seedUrls: string[] = [];
          for (let i = 0; i < reviewFiles.length; i++) {
            const rf = reviewFiles[i]!;
            const safeName = `${userId}_${Date.now()}_${i}.${rf.mimetype.split("/")[1] ?? "png"}`;
            seedUrls.push(await kieUploadFile(rf.buffer, safeName, rf.mimetype));
          }

          await db
            .update(ordersTable)
            .set({ sourcePhotoUrl: seedUrls[0] ?? null, sourcePhotos: seedUrls })
            .where(eq(ordersTable.id, orderId));

          // One sequential chain per set. Errors inside a chain stop only that
          // chain — other chains keep producing photos.
          const runChain = async (): Promise<void> => {
            try {
              let inputUrls = seedUrls;
              for (let step = 0; step < PHOTOS_PER_SET; step++) {
                const locPrompt = pickRandom(reviewPromptPool);
                let prompt = composeReviewPrompt(service.prompt, locPrompt, reviewItem, reviewAge);
                if (step > 0) {
                  prompt += " " + POSE_VARIATIONS[(step - 1) % POSE_VARIATIONS.length]!;
                }
                const taskId = await kieCreateNanoBananaProTask({
                  prompt,
                  imageUrls: inputUrls,
                  aspectRatio: "auto",
                  resolution: "2K",
                });
                const resultUrl = await waitForKieResult(taskId);
                if (!resultUrl) return; // step failed/timed out; stop this chain
                const mirrored = await mirrorRemoteImage(resultUrl, req.log);
                await appendResultPhoto(orderId, mirrored);
                // The next photo is generated FROM this one (kie-hosted result url).
                inputUrls = [resultUrl];
              }
            } catch (err) {
              req.log.error({ err, orderId }, "review chain failed");
            }
          };

          await Promise.all(Array.from({ length: reviewSets }, () => runChain()));

          // Finalize: success if we produced any photos, otherwise refund.
          const [fin] = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId)).limit(1);
          if (fin && fin.status === "processing") {
            if ((fin.resultPhotos?.length ?? 0) > 0) {
              await db
                .update(ordersTable)
                .set({ status: "success", completedAt: new Date() })
                .where(and(eq(ordersTable.id, orderId), eq(ordersTable.status, "processing")));
            } else {
              await refundAndFail("Не удалось сгенерировать фото");
            }
          }
        } catch (err) {
          req.log.error({ err, orderId }, "review kie kickoff failed; refunding");
          await refundAndFail(err instanceof Error ? err.message : "Не удалось запустить генерацию");
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

// Auto-fail tasks that have been processing too long.
const STUCK_TASK_MS = 30 * 60 * 1000;

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

  // Review orders are driven by a background sequential-chain job that writes
  // resultPhotos incrementally and sets the final status. Here we just surface
  // the current DB state, with a timeout safety net in case the background
  // worker died (e.g. a server restart mid-generation).
  if (order.serviceKey === "review") {
    const aged = Date.now() - order.createdAt.getTime() > STUCK_TASK_MS;
    if (aged && order.status === "processing") {
      if ((order.resultPhotos?.length ?? 0) > 0) {
        await db
          .update(ordersTable)
          .set({ status: "success", completedAt: new Date() })
          .where(and(eq(ordersTable.id, order.id), eq(ordersTable.status, "processing")));
        res.json({ orderId: order.id, status: "success", resultPhotos: order.resultPhotos ?? [] });
        return;
      }
      await failAndRefund("Превышено время ожидания генерации");
      res.json({ orderId: order.id, status: "failed", errorMessage: "Превышено время ожидания генерации", refunded: true });
      return;
    }
    res.json({ orderId: order.id, status: order.status, resultPhotos: order.resultPhotos ?? [] });
    return;
  }

  const ageMs = Date.now() - order.createdAt.getTime();
  if (ageMs > STUCK_TASK_MS) {
    await failAndRefund("Превышено время ожидания генерации");
    res.json({ orderId: order.id, status: "failed", errorMessage: "Превышено время ожидания генерации", refunded: true });
    return;
  }

  if (!order.kieTaskId) {
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
