import { Router, type IRouter } from "express";
import multer from "multer";
import { db, ordersTable, stylesTable, usersTable } from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { kieUploadFile, kieCreateNanoBananaProTask, kieGetTask } from "../lib/kie";

const router: IRouter = Router();

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES, files: 3 },
});

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    if (user.isBlocked) {
      res.status(403).json({ error: "Account blocked" });
      return;
    }
    const price = Number(style.price);

    // 1) Atomically deduct balance FIRST (prevents unpaid task creation on race).
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

    // 2) Create a pending order row so any later failure has a record to refund against.
    const [pendingOrder] = await db
      .insert(ordersTable)
      .values({
        userId,
        styleId,
        status: "processing",
        amount: price.toFixed(2),
        sourcePhotos: [],
      })
      .returning();
    const orderId = pendingOrder!.id;

    // Helper to refund this order exactly once.
    async function refundAndFail(message: string): Promise<void> {
      const transitioned = await db
        .update(ordersTable)
        .set({ status: "failed", errorMessage: message, completedAt: new Date() })
        .where(and(eq(ordersTable.id, orderId), eq(ordersTable.status, "processing")))
        .returning({ id: ordersTable.id });
      if (transitioned.length > 0) {
        await db
          .update(usersTable)
          .set({
            balance: sql`${usersTable.balance} + ${price.toFixed(2)}`,
            totalSpent: sql`greatest(${usersTable.totalSpent} - ${price.toFixed(2)}, 0)`,
          })
          .where(eq(usersTable.id, userId));
      }
    }

    try {
      // 3) Upload photos to kie.ai.
      const uploadedUrls: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const f = files[i]!;
        const safeName = `${userId}_${Date.now()}_${i}.${f.mimetype.split("/")[1] ?? "png"}`;
        const url = await kieUploadFile(f.buffer, safeName, f.mimetype);
        uploadedUrls.push(url);
      }

      // 4) Submit the generation task.
      const taskId = await kieCreateNanoBananaProTask({
        prompt: style.prompt,
        imageUrls: uploadedUrls,
        aspectRatio: "auto",
        resolution: "2K",
      });

      // 5) Persist source URLs + task id on the order.
      await db
        .update(ordersTable)
        .set({
          sourcePhotoUrl: uploadedUrls[0] ?? null,
          sourcePhotos: uploadedUrls,
          kieTaskId: taskId,
        })
        .where(eq(ordersTable.id, orderId));

      // Bump style.ordersCount (best effort).
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

// Auto-fail tasks that have been processing too long.
const STUCK_TASK_MS = 15 * 60 * 1000; // 15 minutes

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

  // Terminal states — just return what we have.
  if (order.status === "success" || order.status === "failed") {
    res.json({
      orderId: order.id,
      status: order.status,
      resultPhotos: order.resultPhotos ?? [],
      errorMessage: order.errorMessage,
    });
    return;
  }

  // Idempotent refund helper — only the first caller that wins the
  // status='processing' -> 'failed' transition triggers the credit, preventing
  // double-refund races between concurrent polls.
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

  // Auto-fail stuck tasks (covers cases where kie hangs or createTask never set kieTaskId).
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
      // Idempotent success transition.
      await db
        .update(ordersTable)
        .set({ status: "success", resultPhotos: info.resultUrls, completedAt: new Date() })
        .where(and(eq(ordersTable.id, order.id), eq(ordersTable.status, "processing")));
      res.json({ orderId: order.id, status: "success", resultPhotos: info.resultUrls });
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
