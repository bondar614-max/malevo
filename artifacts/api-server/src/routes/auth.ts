import { Router, type IRouter } from "express";
import { ZipArchive, type ArchiverError } from "archiver";
import { randomUUID } from "node:crypto";
import { db, usersTable, ordersTable, stylesTable, servicesTable, locationsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";
import { RegisterBody, LoginBody } from "@workspace/api-zod";
import { hashPassword, comparePassword, signToken, requireAuth } from "../lib/auth";
import { uploadBufferToStorage, isLocalStorageUrl, downloadStorageObject } from "../lib/storage-helpers";

async function mirrorIfRemote(url: string): Promise<string> {
  if (isLocalStorageUrl(url)) return url;
  try {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 30_000);
    const r = await fetch(url, { signal: ac.signal });
    clearTimeout(t);
    if (!r.ok) return url;
    const ct = (r.headers.get("content-type") ?? "image/png").split(";")[0]!.trim();
    const buf = Buffer.from(await r.arrayBuffer());
    return await uploadBufferToStorage(buf, ct, "generated");
  } catch { return url; }
}

const router: IRouter = Router();

function zipSafeName(value: string): string {
  const normalized = value
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .slice(0, 80);
  return normalized || "photos";
}

function extensionFromContentType(contentType: string): string {
  switch (contentType.split(";")[0]?.trim()) {
    case "image/jpeg": return "jpg";
    case "image/png": return "png";
    case "image/webp": return "webp";
    case "image/gif": return "gif";
    default: return "jpg";
  }
}

async function downloadResultPhoto(url: string): Promise<{ buffer: Buffer; contentType: string }> {
  if (isLocalStorageUrl(url)) return downloadStorageObject(url);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`Image request failed: ${response.status}`);
    const contentType = response.headers.get("content-type") ?? "image/jpeg";
    return { buffer: Buffer.from(await response.arrayBuffer()), contentType };
  } finally {
    clearTimeout(timeout);
  }
}

function userResponse(u: typeof usersTable.$inferSelect) {
  return {
    id: u.id,
    email: u.email,
    name: u.name ?? "",
    role: u.role,
    balance: Number(u.balance ?? 0),
    totalSpent: Number(u.totalSpent ?? 0),
    createdAt: u.createdAt.toISOString(),
    lastLogin: u.lastLogin ? u.lastLogin.toISOString() : null,
  };
}

router.post("/auth/register", async (req, res) => {
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const { email, name, password } = parsed.data;
  const existing = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (existing.length > 0) {
    res.status(409).json({ error: "Email уже зарегистрирован" });
    return;
  }
  const passwordHash = await hashPassword(password);
  const id = randomUUID();
  await db
    .insert(usersTable)
    .values({ id, email, name: name ?? null, passwordHash });
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
  const token = signToken({ userId: user!.id, email: user!.email });
  res.status(201).json({ token, user: userResponse(user!) });
});

router.post("/auth/login", async (req, res) => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const { email, password } = parsed.data;
  const rows = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  const user = rows[0];
  if (!user) {
    res.status(401).json({ error: "Неверный email или пароль" });
    return;
  }
  const ok = await comparePassword(password, user.passwordHash);
  if (!ok) {
    res.status(401).json({ error: "Неверный email или пароль" });
    return;
  }
  await db.update(usersTable).set({ lastLogin: new Date() }).where(eq(usersTable.id, user.id));
  const token = signToken({ userId: user.id, email: user.email });
  res.json({ token, user: userResponse(user) });
});

router.get("/auth/me", requireAuth, async (req, res) => {
  const rows = await db.select().from(usersTable).where(eq(usersTable.id, req.auth!.userId)).limit(1);
  const user = rows[0];
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  res.json(userResponse(user));
});

const UpdateMeBody = z.object({
  name: z.string().max(120).optional(),
  email: z.string().email().optional(),
  currentPassword: z.string().optional(),
  newPassword: z.string().min(6).optional(),
});

router.patch("/auth/me", requireAuth, async (req, res) => {
  const parsed = UpdateMeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Некорректные данные" });
    return;
  }
  const data = parsed.data;
  const rows = await db.select().from(usersTable).where(eq(usersTable.id, req.auth!.userId)).limit(1);
  const user = rows[0];
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const updates: Partial<typeof usersTable.$inferInsert> = {};
  if (typeof data.name === "string") updates.name = data.name;

  if (data.email && data.email !== user.email) {
    const dupe = await db.select().from(usersTable).where(eq(usersTable.email, data.email)).limit(1);
    if (dupe.length > 0) {
      res.status(409).json({ error: "Email уже занят" });
      return;
    }
    updates.email = data.email;
  }

  if (data.newPassword) {
    if (!data.currentPassword) {
      res.status(400).json({ error: "Введите текущий пароль" });
      return;
    }
    const ok = await comparePassword(data.currentPassword, user.passwordHash);
    if (!ok) {
      res.status(400).json({ error: "Неверный текущий пароль" });
      return;
    }
    updates.passwordHash = await hashPassword(data.newPassword);
  }

  if (Object.keys(updates).length === 0) {
    res.json(userResponse(user));
    return;
  }

  await db.update(usersTable).set(updates).where(eq(usersTable.id, user.id));
  const [updated] = await db.select().from(usersTable).where(eq(usersTable.id, user.id)).limit(1);
  res.json(userResponse(updated!));
});

router.get("/auth/me/orders", requireAuth, async (req, res) => {
  const rows = await db
    .select({
      id: ordersTable.id,
      status: ordersTable.status,
      amount: ordersTable.amount,
      sourcePhotoUrl: ordersTable.sourcePhotoUrl,
      anchorPhotoUrl: ordersTable.anchorPhotoUrl,
      resultPhotos: ordersTable.resultPhotos,
      createdAt: ordersTable.createdAt,
      completedAt: ordersTable.completedAt,
      styleId: ordersTable.styleId,
      styleTitle: stylesTable.title,
      stylePreview: stylesTable.previewImageUrl,
      serviceKey: ordersTable.serviceKey,
      serviceTitle: servicesTable.title,
      servicePreview: servicesTable.previewImageUrl,
      locationId: ordersTable.locationId,
      locationName: locationsTable.name,
    })
    .from(ordersTable)
    .leftJoin(stylesTable, eq(ordersTable.styleId, stylesTable.id))
    .leftJoin(servicesTable, eq(ordersTable.serviceKey, servicesTable.key))
    .leftJoin(locationsTable, eq(ordersTable.locationId, locationsTable.id))
    .where(eq(ordersTable.userId, req.auth!.userId))
    .orderBy(desc(ordersTable.createdAt));

  // Lazy migration: orders generated before the local-mirror feature still
  // point at kie.ai temp URLs (large, third-party CDN, attachment disposition)
  // that browsers struggle to render. Mirror to /api/static/generated/... on
  // first read and persist so subsequent loads are fast and self-hosted.
  const processed = await Promise.all(rows.map(async (r) => {
    const photos = r.resultPhotos ?? [];
    const needsMigration = r.status === "success" && photos.some((p) => !p.startsWith("/api/static/"));
    let finalPhotos = photos;
    if (needsMigration) {
      finalPhotos = await Promise.all(photos.map(mirrorIfRemote));
      const changed = finalPhotos.some((u, i) => u !== photos[i]);
      if (changed) {
        await db.update(ordersTable).set({ resultPhotos: finalPhotos }).where(eq(ordersTable.id, r.id));
      }
    }
    return { ...r, resultPhotos: finalPhotos };
  }));

  res.json(
    processed.map((r) => ({
      id: r.id,
      status: r.status,
      amount: Number(r.amount),
      sourcePhotoUrl: r.sourcePhotoUrl,
      anchorPhotoUrl: r.anchorPhotoUrl,
      resultPhotos: r.resultPhotos,
      createdAt: r.createdAt.toISOString(),
      completedAt: r.completedAt ? r.completedAt.toISOString() : null,
      styleId: r.styleId,
      styleTitle: r.styleTitle,
      stylePreview: r.stylePreview,
      serviceKey: r.serviceKey,
      serviceTitle: r.serviceTitle,
      servicePreview: r.servicePreview,
      locationId: r.locationId,
      locationName: r.locationName,
    })),
  );
});

router.get("/auth/me/orders/:orderId/photos.zip", requireAuth, async (req, res) => {
  const orderId = Array.isArray(req.params.orderId) ? req.params.orderId[0] : req.params.orderId;
  if (!orderId) {
    res.status(400).json({ error: "Некорректный ID заказа" });
    return;
  }
  const [order] = await db
    .select({
      id: ordersTable.id,
      userId: ordersTable.userId,
      resultPhotos: ordersTable.resultPhotos,
      styleTitle: stylesTable.title,
      serviceTitle: servicesTable.title,
    })
    .from(ordersTable)
    .leftJoin(stylesTable, eq(ordersTable.styleId, stylesTable.id))
    .leftJoin(servicesTable, eq(ordersTable.serviceKey, servicesTable.key))
    .where(eq(ordersTable.id, orderId))
    .limit(1);

  if (!order || order.userId !== req.auth!.userId) {
    res.status(404).json({ error: "Заказ не найден" });
    return;
  }

  const photos = order.resultPhotos ?? [];
  if (photos.length === 0) {
    res.status(404).json({ error: "В заказе пока нет готовых фото" });
    return;
  }

  try {
    const files = await Promise.all(photos.map(downloadResultPhoto));
    const baseName = zipSafeName(order.serviceTitle ?? order.styleTitle ?? "generation");
    const archiveName = `${baseName}-${order.id.slice(0, 8)}.zip`;
    const archive = new ZipArchive({ zlib: { level: 9 } });

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${archiveName}"; filename*=UTF-8''${encodeURIComponent(archiveName)}`);

    archive.on("error", (err: ArchiverError) => {
      req.log.error({ err, orderId: order.id }, "failed to create order photos zip");
      if (!res.headersSent) res.status(500).json({ error: "Не удалось собрать архив" });
      else res.destroy(err);
    });

    archive.pipe(res);
    files.forEach((file, index) => {
      const ext = extensionFromContentType(file.contentType);
      archive.append(file.buffer, { name: `photo-${String(index + 1).padStart(2, "0")}.${ext}` });
    });
    await archive.finalize();
  } catch (err) {
    req.log.error({ err, orderId: order.id }, "failed to download order photos for zip");
    if (!res.headersSent) res.status(502).json({ error: "Не удалось скачать одно из фото для архива" });
  }
});

export default router;
