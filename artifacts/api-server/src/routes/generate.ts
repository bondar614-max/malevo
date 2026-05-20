import { Router, type IRouter } from "express";
import multer from "multer";
import { db, ordersTable, stylesTable, usersTable, servicesTable, locationsTable } from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { kieUploadFile, kieCreateNanoBananaProTask, kieGetTask } from "../lib/kie";
import { uploadBufferToStorage } from "../lib/storage-helpers";

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
      resolvedLocationId = loc.id;
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

    const [pendingOrder] = await db
      .insert(ordersTable)
      .values({
        userId,
        serviceKey: service.key,
        locationId: resolvedLocationId,
        status: "processing",
        amount: price.toFixed(2),
        sourcePhotos: [],
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
    res.json({ orderId: order.id, status: order.status, resultPhotos: [] });
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
