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

    // ===== Review: generate directly via kie.ai, one task per photo =====
    if (isReview) {
      // Snapshot buffers/metadata for the async kickoff (multer memory storage).
      const reviewFiles = files.map((f) => ({ buffer: f.buffer, mimetype: f.mimetype }));

      // Respond immediately; create kie.ai tasks in the background.
      res.status(201).json({ orderId, status: "processing" });

      void (async () => {
        try {
          // Upload source photo(s) once; reuse the URLs for every task.
          const uploadedUrls: string[] = [];
          for (let i = 0; i < reviewFiles.length; i++) {
            const rf = reviewFiles[i]!;
            const safeName = `${userId}_${Date.now()}_${i}.${rf.mimetype.split("/")[1] ?? "png"}`;
            const url = await kieUploadFile(rf.buffer, safeName, rf.mimetype);
            uploadedUrls.push(url);
          }

          await db
            .update(ordersTable)
            .set({ sourcePhotoUrl: uploadedUrls[0] ?? null, sourcePhotos: uploadedUrls })
            .where(eq(ordersTable.id, orderId));

          // One task per expected photo, each with a randomly chosen prompt.
          const taskIds: string[] = [];
          for (let i = 0; i < expectedPhotos; i++) {
            const chosen = pickRandom(reviewPromptPool);
            const prompt = composeReviewPrompt(service.prompt, chosen, reviewItem, reviewAge);
            const taskId = await kieCreateNanoBananaProTask({
              prompt,
              imageUrls: uploadedUrls,
              aspectRatio: "auto",
              resolution: "2K",
            });
            taskIds.push(taskId);
          }

          await db
            .update(ordersTable)
            .set({ kieTaskIds: taskIds })
            .where(eq(ordersTable.id, orderId));
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

  // Review orders fan out to many kie tasks (one per photo). We poll every task
  // OUTSIDE a transaction (network calls), then merge results atomically under a
  // row lock so concurrent polls can't clobber each other. `receivedPhotoNumbers`
  // is reused to track which task indices have finished.
  if (order.serviceKey === "review") {
    const taskIds = order.kieTaskIds ?? [];
    if (taskIds.length === 0) {
      // Tasks are still being created in the background.
      res.json({ orderId: order.id, status: order.status, resultPhotos: order.resultPhotos ?? [] });
      return;
    }
    try {
      // Poll only indices not already known to be finished; mirror successes.
      const known = new Set<number>(order.receivedPhotoNumbers ?? []);
      const newlyDone: { idx: number; url: string | null }[] = [];
      for (let i = 0; i < taskIds.length; i++) {
        if (known.has(i)) continue;
        const info = await kieGetTask(taskIds[i]!);
        if (info.state === "success" && info.resultUrls.length > 0) {
          const mirrored = await mirrorRemoteImage(info.resultUrls[0]!, req.log);
          newlyDone.push({ idx: i, url: mirrored });
        } else if (info.state === "fail") {
          newlyDone.push({ idx: i, url: null });
        }
      }

      // Merge under a row lock against the freshest state.
      const merged = await db.transaction(async (tx) => {
        const [fresh] = await tx
          .select()
          .from(ordersTable)
          .where(eq(ordersTable.id, order.id))
          .for("update")
          .limit(1);
        if (!fresh || fresh.status !== "processing") {
          return { status: fresh?.status ?? "failed", photos: fresh?.resultPhotos ?? [], refunded: false };
        }
        const done = new Set<number>(fresh.receivedPhotoNumbers ?? []);
        const photos = [...fresh.resultPhotos];
        for (const n of newlyDone) {
          if (done.has(n.idx)) continue;
          done.add(n.idx);
          if (n.url) photos.push(n.url);
        }
        const finished = done.size >= taskIds.length;
        const aged = Date.now() - fresh.createdAt.getTime() > STUCK_TASK_MS;

        let status: "processing" | "success" | "failed" = "processing";
        let errorMessage: string | null = null;
        if (photos.length > 0 && (finished || aged)) {
          status = "success";
        } else if (photos.length === 0 && (finished || aged)) {
          status = "failed";
          errorMessage = finished ? "Не удалось сгенерировать фото" : "Превышено время ожидания генерации";
        }

        await tx
          .update(ordersTable)
          .set({
            resultPhotos: photos,
            receivedPhotoNumbers: [...done],
            status,
            errorMessage,
            completedAt: status === "processing" ? null : new Date(),
          })
          .where(eq(ordersTable.id, fresh.id));

        let refunded = false;
        if (status === "failed" && fresh.userId) {
          await tx
            .update(usersTable)
            .set({
              balance: sql`${usersTable.balance} + ${fresh.amount}`,
              totalSpent: sql`greatest(${usersTable.totalSpent} - ${fresh.amount}, 0)`,
            })
            .where(eq(usersTable.id, fresh.userId));
          refunded = true;
        }
        return { status, photos, refunded, errorMessage };
      });

      res.json({
        orderId: order.id,
        status: merged.status,
        resultPhotos: merged.photos,
        ...(merged.status === "failed" ? { errorMessage: merged.errorMessage, refunded: merged.refunded } : {}),
      });
      return;
    } catch (err) {
      req.log.error({ err, orderId: order.id }, "review status check failed");
      res.json({ orderId: order.id, status: "processing", resultPhotos: order.resultPhotos ?? [] });
      return;
    }
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
