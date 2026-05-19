import { Router, type IRouter } from "express";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { db, usersTable, ordersTable, stylesTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";
import { RegisterBody, LoginBody } from "@workspace/api-zod";
import { hashPassword, comparePassword, signToken, requireAuth } from "../lib/auth";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const generatedDir = path.resolve(__dirname, "..", "public", "generated");
fs.mkdirSync(generatedDir, { recursive: true });

async function mirrorIfRemote(url: string): Promise<string> {
  if (url.startsWith("/api/static/")) return url;
  try {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 30_000);
    const r = await fetch(url, { signal: ac.signal });
    clearTimeout(t);
    if (!r.ok) return url;
    const ct = (r.headers.get("content-type") ?? "image/png").split(";")[0]!.trim();
    const extMap: Record<string, string> = { "image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp", "image/gif": ".gif" };
    const ext = extMap[ct] ?? ".png";
    const buf = Buffer.from(await r.arrayBuffer());
    const name = `${Date.now()}_${crypto.randomBytes(6).toString("hex")}${ext}`;
    await fs.promises.writeFile(path.join(generatedDir, name), buf);
    return `/api/static/generated/${name}`;
  } catch { return url; }
}

const router: IRouter = Router();

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
  const [user] = await db
    .insert(usersTable)
    .values({ email, name: name ?? null, passwordHash })
    .returning();
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

  const [updated] = await db.update(usersTable).set(updates).where(eq(usersTable.id, user.id)).returning();
  res.json(userResponse(updated!));
});

router.get("/auth/me/orders", requireAuth, async (req, res) => {
  const rows = await db
    .select({
      id: ordersTable.id,
      status: ordersTable.status,
      amount: ordersTable.amount,
      sourcePhotoUrl: ordersTable.sourcePhotoUrl,
      resultPhotos: ordersTable.resultPhotos,
      createdAt: ordersTable.createdAt,
      completedAt: ordersTable.completedAt,
      styleId: stylesTable.id,
      styleTitle: stylesTable.title,
      stylePreview: stylesTable.previewImageUrl,
    })
    .from(ordersTable)
    .leftJoin(stylesTable, eq(ordersTable.styleId, stylesTable.id))
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
      resultPhotos: r.resultPhotos,
      createdAt: r.createdAt.toISOString(),
      completedAt: r.completedAt ? r.completedAt.toISOString() : null,
      styleId: r.styleId,
      styleTitle: r.styleTitle,
      stylePreview: r.stylePreview,
    })),
  );
});

export default router;
