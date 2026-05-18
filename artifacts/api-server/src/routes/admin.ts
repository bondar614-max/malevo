import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db, usersTable, ordersTable, stylesTable, tariffsTable } from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";
import { z } from "zod";
import { hashPassword, requireAuth } from "../lib/auth";

const router: IRouter = Router();

async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.auth) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const rows = await db.select({ role: usersTable.role }).from(usersTable).where(eq(usersTable.id, req.auth.userId)).limit(1);
  if (rows[0]?.role !== "admin") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  next();
}

router.use(requireAuth, requireAdmin);

// ---------- Users ----------
router.get("/admin/users", async (_req, res) => {
  const rows = await db.select().from(usersTable).orderBy(desc(usersTable.createdAt));
  res.json(
    rows.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name ?? "",
      role: u.role,
      isBlocked: u.isBlocked,
      balance: Number(u.balance),
      totalSpent: Number(u.totalSpent),
      createdAt: u.createdAt.toISOString(),
      lastLogin: u.lastLogin ? u.lastLogin.toISOString() : null,
    })),
  );
});

const UpdateUserSchema = z.object({
  email: z.string().email().optional(),
  name: z.string().optional(),
  password: z.string().min(6).optional(),
  role: z.enum(["user", "admin"]).optional(),
  isBlocked: z.boolean().optional(),
  balance: z.number().nonnegative().optional(),
  totalSpent: z.number().nonnegative().optional(),
});

router.patch("/admin/users/:id", async (req, res) => {
  const parsed = UpdateUserSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.message });
    return;
  }
  const updates: Record<string, unknown> = {};
  const d = parsed.data;
  if (d.email !== undefined) updates.email = d.email;
  if (d.name !== undefined) updates.name = d.name;
  if (d.role !== undefined) updates.role = d.role;
  if (d.isBlocked !== undefined) updates.isBlocked = d.isBlocked;
  if (d.balance !== undefined) updates.balance = d.balance.toFixed(2);
  if (d.totalSpent !== undefined) updates.totalSpent = d.totalSpent.toFixed(2);
  if (d.password) updates.passwordHash = await hashPassword(d.password);

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "Nothing to update" });
    return;
  }
  const [user] = await db.update(usersTable).set(updates).where(eq(usersTable.id, req.params.id)).returning();
  if (!user) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json({ ok: true });
});

router.delete("/admin/users/:id", async (req, res) => {
  if (req.params.id === req.auth!.userId) {
    res.status(400).json({ error: "Cannot delete yourself" });
    return;
  }
  await db.delete(usersTable).where(eq(usersTable.id, req.params.id));
  res.json({ ok: true });
});

// ---------- Orders / Generations ----------
router.get("/admin/orders", async (_req, res) => {
  const rows = await db
    .select({
      id: ordersTable.id,
      userId: ordersTable.userId,
      userEmail: usersTable.email,
      styleId: ordersTable.styleId,
      styleTitle: stylesTable.title,
      status: ordersTable.status,
      amount: ordersTable.amount,
      sourcePhotoUrl: ordersTable.sourcePhotoUrl,
      resultPhotos: ordersTable.resultPhotos,
      createdAt: ordersTable.createdAt,
      completedAt: ordersTable.completedAt,
    })
    .from(ordersTable)
    .leftJoin(usersTable, eq(usersTable.id, ordersTable.userId))
    .leftJoin(stylesTable, eq(stylesTable.id, ordersTable.styleId))
    .orderBy(desc(ordersTable.createdAt))
    .limit(500);
  res.json(
    rows.map((o) => ({
      ...o,
      amount: Number(o.amount),
      createdAt: o.createdAt.toISOString(),
      completedAt: o.completedAt ? o.completedAt.toISOString() : null,
    })),
  );
});

// ---------- Tariffs ----------
const TariffSchema = z.object({
  name: z.string().min(1),
  description: z.string().default(""),
  price: z.number().nonnegative(),
  generationsIncluded: z.number().int().positive(),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});

router.get("/admin/tariffs", async (_req, res) => {
  const rows = await db.select().from(tariffsTable).orderBy(tariffsTable.sortOrder);
  res.json(rows.map((t) => ({ ...t, price: Number(t.price), createdAt: t.createdAt.toISOString() })));
});

router.post("/admin/tariffs", async (req, res) => {
  const parsed = TariffSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }
  const [t] = await db.insert(tariffsTable).values({ ...parsed.data, price: parsed.data.price.toFixed(2) }).returning();
  res.status(201).json(t);
});

router.patch("/admin/tariffs/:id", async (req, res) => {
  const parsed = TariffSchema.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }
  const updates: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.price !== undefined) updates.price = parsed.data.price.toFixed(2);
  await db.update(tariffsTable).set(updates).where(eq(tariffsTable.id, req.params.id));
  res.json({ ok: true });
});

router.delete("/admin/tariffs/:id", async (req, res) => {
  await db.delete(tariffsTable).where(eq(tariffsTable.id, req.params.id));
  res.json({ ok: true });
});

// ---------- Styles CRUD ----------
const StyleSchema = z.object({
  title: z.string().min(1),
  shortDescription: z.string().min(1),
  fullDescription: z.string().default(""),
  category: z.string().min(1),
  price: z.number().nonnegative(),
  previewImageUrl: z.string().min(1),
  exampleImages: z.array(z.string()).default([]),
  generationTime: z.number().int().positive().default(60),
  rating: z.number().min(0).max(5).default(4.9),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().optional(),
  ordersCount: z.number().int().nonnegative().default(0),
});

router.get("/admin/styles", async (_req, res) => {
  const rows = await db.select().from(stylesTable).orderBy(stylesTable.sortOrder);
  res.json(rows.map((s) => ({ ...s, price: Number(s.price), rating: Number(s.rating), createdAt: s.createdAt.toISOString() })));
});

router.post("/admin/styles", async (req, res) => {
  const parsed = StyleSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input", details: parsed.error.message }); return; }
  const d = parsed.data;
  let sortOrder = d.sortOrder;
  if (sortOrder === undefined) {
    const maxRow = await db.select({ m: sql<number>`coalesce(max(${stylesTable.sortOrder}),0)::int` }).from(stylesTable);
    sortOrder = (maxRow[0]?.m ?? 0) + 1;
  }
  const [s] = await db.insert(stylesTable).values({
    title: d.title,
    shortDescription: d.shortDescription,
    fullDescription: d.fullDescription,
    category: d.category,
    price: d.price.toFixed(2),
    previewImageUrl: d.previewImageUrl,
    exampleImages: d.exampleImages,
    generationTime: d.generationTime,
    rating: d.rating.toFixed(2),
    isActive: d.isActive,
    sortOrder,
    ordersCount: d.ordersCount,
  }).returning();
  res.status(201).json(s);
});

router.patch("/admin/styles/:id", async (req, res) => {
  const parsed = StyleSchema.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }
  const d = parsed.data;
  const updates: Record<string, unknown> = {};
  if (d.title !== undefined) updates.title = d.title;
  if (d.shortDescription !== undefined) updates.shortDescription = d.shortDescription;
  if (d.fullDescription !== undefined) updates.fullDescription = d.fullDescription;
  if (d.category !== undefined) updates.category = d.category;
  if (d.price !== undefined) updates.price = d.price.toFixed(2);
  if (d.previewImageUrl !== undefined) updates.previewImageUrl = d.previewImageUrl;
  if (d.exampleImages !== undefined) updates.exampleImages = d.exampleImages;
  if (d.generationTime !== undefined) updates.generationTime = d.generationTime;
  if (d.rating !== undefined) updates.rating = d.rating.toFixed(2);
  if (d.isActive !== undefined) updates.isActive = d.isActive;
  if (d.sortOrder !== undefined) updates.sortOrder = d.sortOrder;
  if (d.ordersCount !== undefined) updates.ordersCount = d.ordersCount;
  await db.update(stylesTable).set(updates).where(eq(stylesTable.id, req.params.id));
  res.json({ ok: true });
});

router.delete("/admin/styles/:id", async (req, res) => {
  await db.delete(stylesTable).where(eq(stylesTable.id, req.params.id));
  res.json({ ok: true });
});

export default router;
