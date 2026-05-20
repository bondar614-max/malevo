import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db, servicesTable, locationsTable, usersTable } from "@workspace/db";
import { eq, asc, and } from "drizzle-orm";
import { z } from "zod";
import { requireAuth } from "../lib/auth";

const router: IRouter = Router();

function serializeService(s: typeof servicesTable.$inferSelect) {
  return {
    key: s.key,
    title: s.title,
    shortDescription: s.shortDescription,
    fullDescription: s.fullDescription,
    previewImageUrl: s.previewImageUrl,
    price: Number(s.price),
    photosMin: s.photosMin,
    photosMax: s.photosMax,
    generationTime: s.generationTime,
    accentFrom: s.accentFrom,
    accentTo: s.accentTo,
    badge: s.badge,
    sortOrder: s.sortOrder,
    isActive: s.isActive,
  };
}

function serializeLocation(l: typeof locationsTable.$inferSelect) {
  return {
    id: l.id,
    serviceKey: l.serviceKey,
    name: l.name,
    previewImageUrl: l.previewImageUrl,
    sortOrder: l.sortOrder,
    isActive: l.isActive,
  };
}

// ===== Public =====
router.get("/services", async (_req, res) => {
  const rows = await db.select().from(servicesTable).where(eq(servicesTable.isActive, true)).orderBy(asc(servicesTable.sortOrder));
  res.json(rows.map(serializeService));
});

router.get("/services/:key", async (req, res) => {
  const key = String(req.params.key);
  const [row] = await db.select().from(servicesTable).where(eq(servicesTable.key, key)).limit(1);
  if (!row || !row.isActive) {
    res.status(404).json({ error: "Service not found" });
    return;
  }
  res.json(serializeService(row));
});

router.get("/services/:key/locations", async (req, res) => {
  const rows = await db
    .select()
    .from(locationsTable)
    .where(and(eq(locationsTable.serviceKey, String(req.params.key)), eq(locationsTable.isActive, true)))
    .orderBy(asc(locationsTable.sortOrder));
  res.json(rows.map(serializeLocation));
});

// ===== Admin =====
async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.auth) { res.status(401).json({ error: "Unauthorized" }); return; }
  const rows = await db.select({ role: usersTable.role }).from(usersTable).where(eq(usersTable.id, req.auth.userId)).limit(1);
  if (rows[0]?.role !== "admin") { res.status(403).json({ error: "Forbidden" }); return; }
  next();
}

router.get("/admin/services", requireAuth, requireAdmin, async (_req, res) => {
  const rows = await db.select().from(servicesTable).orderBy(asc(servicesTable.sortOrder));
  res.json(rows.map((r) => ({ ...serializeService(r), prompt: r.prompt })));
});

const ServiceUpdateSchema = z.object({
  title: z.string().min(1).optional(),
  shortDescription: z.string().optional(),
  fullDescription: z.string().optional(),
  prompt: z.string().optional(),
  previewImageUrl: z.string().optional(),
  price: z.number().nonnegative().optional(),
  photosMin: z.number().int().min(1).max(10).optional(),
  photosMax: z.number().int().min(1).max(10).optional(),
  generationTime: z.number().int().positive().optional(),
  isActive: z.boolean().optional(),
  accentFrom: z.string().optional(),
  accentTo: z.string().optional(),
  badge: z.string().optional(),
  sortOrder: z.number().int().optional(),
});

router.patch("/admin/services/:key", requireAuth, requireAdmin, async (req, res) => {
  const parsed = ServiceUpdateSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input", details: parsed.error.message }); return; }
  const d = parsed.data;
  const key = String(req.params.key);
  const [current] = await db.select().from(servicesTable).where(eq(servicesTable.key, key)).limit(1);
  if (!current) { res.status(404).json({ error: "Service not found" }); return; }
  const updates: Record<string, unknown> = { ...d };
  if (d.price !== undefined) updates.price = d.price.toFixed(2);
  const effectiveMin = d.photosMin ?? current.photosMin;
  const effectiveMax = d.photosMax ?? current.photosMax;
  if (effectiveMin > effectiveMax) {
    res.status(400).json({ error: "photosMin не может быть больше photosMax" });
    return;
  }
  await db.update(servicesTable).set(updates).where(eq(servicesTable.key, key));
  res.json({ ok: true });
});

// Locations admin CRUD
router.get("/admin/locations", requireAuth, requireAdmin, async (req, res) => {
  const serviceKey = typeof req.query.serviceKey === "string" ? req.query.serviceKey : undefined;
  const base = db.select().from(locationsTable);
  const rows = await (serviceKey
    ? base.where(eq(locationsTable.serviceKey, serviceKey)).orderBy(asc(locationsTable.sortOrder))
    : base.orderBy(asc(locationsTable.sortOrder)));
  res.json(rows.map((r) => ({ ...serializeLocation(r), promptFragment: r.promptFragment })));
});

const LocationCreateSchema = z.object({
  serviceKey: z.string().min(1),
  name: z.string().min(1),
  previewImageUrl: z.string().default(""),
  promptFragment: z.string().default(""),
  sortOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
});

router.post("/admin/locations", requireAuth, requireAdmin, async (req, res) => {
  const parsed = LocationCreateSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }
  const [row] = await db.insert(locationsTable).values(parsed.data).returning();
  res.status(201).json(row);
});

const LocationUpdateSchema = LocationCreateSchema.partial();

router.patch("/admin/locations/:id", requireAuth, requireAdmin, async (req, res) => {
  const parsed = LocationUpdateSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }
  await db.update(locationsTable).set(parsed.data).where(eq(locationsTable.id, String(req.params.id)));
  res.json({ ok: true });
});

router.delete("/admin/locations/:id", requireAuth, requireAdmin, async (req, res) => {
  await db.delete(locationsTable).where(eq(locationsTable.id, String(req.params.id)));
  res.json({ ok: true });
});

export default router;
