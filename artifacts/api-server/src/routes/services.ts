import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { randomUUID } from "node:crypto";
import { db, servicesTable, locationsTable, usersTable, appSettingsTable } from "@workspace/db";
import { eq, asc, and } from "drizzle-orm";
import { z } from "zod";
import { requireAuth } from "../lib/auth";

const router: IRouter = Router();
const PHOTO_EXAMPLES_SETTINGS_KEY = "landing:photo_examples";
const HeroVariantSchema = z.enum(["variant1", "variant2", "variant3", "variant4"]);

const defaultPhotoExamples = {
  heroVariant: "variant3" as const,
  photoshoot: [
    {
      src: "/api/static/generated/8c995cee-716a-42b3-81ae-1c4b832006ce.png",
      title: "Обложка",
      text: "Крупный lifestyle-кадр показывает посадку и цвет товара.",
      className: "sm:col-span-2 lg:col-span-2 lg:row-span-2",
    },
    {
      src: "/api/static/generated/3bf0f84c-6f49-48bf-870d-3b6fe50481b4.jpg",
      title: "Другой ракурс",
      text: "Та же модель и куртка, но новая поза и композиция.",
      className: "",
    },
    {
      src: "/api/static/generated/f8aecf5b-8d2d-4121-bb69-ce7b79225cf3.jpg",
      title: "Каталожный план",
      text: "Средний кадр для карточки, описания или рекламы.",
      className: "",
    },
    {
      src: "/api/static/generated/15258a95-0cce-4f78-9a9f-195cbf544ff8.jpg",
      title: "Детали ткани",
      text: "Отдельный кадр помогает показать фактуру, фурнитуру и швы.",
      className: "sm:col-span-2 lg:col-span-2",
    },
  ],
  reviewBefore: {
    src: "/review-examples/fitting-room-before.png",
    title: "Исходник продавца",
    text: "Обычное фото из кабинки примерочной становится базой для нескольких UGC-вариантов.",
  },
  reviewAfter: [
    {
      src: "/review-examples/fitting-room-after-1.png",
      title: "Чище свет",
      text: "Кадр выглядит как обычный отзыв, но товар легче рассмотреть.",
    },
    {
      src: "/review-examples/fitting-room-after-2.png",
      title: "Новая поза",
      text: "Можно получить другой ракурс без повторной съемки.",
    },
    {
      src: "/review-examples/fitting-room-after-3.png",
      title: "Живой UGC",
      text: "Сохраняется ощущение смартфон-фото из примерочной.",
    },
  ],
};

const ExampleItemSchema = z.object({
  src: z.string().trim().min(1).max(1000),
  title: z.string().trim().min(1).max(120),
  text: z.string().trim().min(1).max(500),
  className: z.string().max(200).optional(),
});

const PhotoExamplesSchema = z.object({
  heroVariant: HeroVariantSchema.default(defaultPhotoExamples.heroVariant),
  photoshoot: z.array(ExampleItemSchema).length(4),
  reviewBefore: ExampleItemSchema.omit({ className: true }),
  reviewAfter: z.array(ExampleItemSchema.omit({ className: true })).length(3),
});

type PhotoExamplesSettings = z.infer<typeof PhotoExamplesSchema>;

function mergePhotoExamples(raw: unknown): PhotoExamplesSettings {
  const parsed = PhotoExamplesSchema.partial().safeParse(raw);
  if (!parsed.success) return defaultPhotoExamples;
  const data = parsed.data;
  return {
    heroVariant: data.heroVariant ?? defaultPhotoExamples.heroVariant,
    photoshoot: defaultPhotoExamples.photoshoot.map((fallback, index) => ({
      ...fallback,
      ...(data.photoshoot?.[index] ?? {}),
      className: fallback.className,
    })),
    reviewBefore: { ...defaultPhotoExamples.reviewBefore, ...(data.reviewBefore ?? {}) },
    reviewAfter: defaultPhotoExamples.reviewAfter.map((fallback, index) => ({
      ...fallback,
      ...(data.reviewAfter?.[index] ?? {}),
    })),
  };
}

async function getPhotoExamples(): Promise<PhotoExamplesSettings> {
  const [row] = await db
    .select({ value: appSettingsTable.value })
    .from(appSettingsTable)
    .where(eq(appSettingsTable.key, PHOTO_EXAMPLES_SETTINGS_KEY))
    .limit(1);
  if (!row?.value) return defaultPhotoExamples;
  try {
    return mergePhotoExamples(JSON.parse(row.value));
  } catch {
    return defaultPhotoExamples;
  }
}

async function setPhotoExamples(settings: PhotoExamplesSettings): Promise<void> {
  await db
    .insert(appSettingsTable)
    .values({
      key: PHOTO_EXAMPLES_SETTINGS_KEY,
      value: JSON.stringify(settings),
      updatedAt: new Date(),
    })
    .onDuplicateKeyUpdate({
      set: { value: JSON.stringify(settings), updatedAt: new Date() },
    });
}

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

router.get("/photo-examples", async (_req, res) => {
  res.json(await getPhotoExamples());
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

router.get("/admin/photo-examples", requireAuth, requireAdmin, async (_req, res) => {
  res.json(await getPhotoExamples());
});

router.patch("/admin/photo-examples", requireAuth, requireAdmin, async (req, res) => {
  const parsed = PhotoExamplesSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.message });
    return;
  }
  const settings = mergePhotoExamples(parsed.data);
  await setPhotoExamples(settings);
  res.json(settings);
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
  res.json(rows.map((r) => ({ ...serializeLocation(r), promptFragment: r.promptFragment, prompts: r.prompts ?? [] })));
});

const LocationCreateSchema = z.object({
  serviceKey: z.string().min(1),
  name: z.string().min(1),
  previewImageUrl: z.string().default(""),
  promptFragment: z.string().default(""),
  prompts: z.array(z.string()).default([]),
  sortOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
});

router.post("/admin/locations", requireAuth, requireAdmin, async (req, res) => {
  const parsed = LocationCreateSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }
  const id = randomUUID();
  await db.insert(locationsTable).values({ id, ...parsed.data });
  const [row] = await db.select().from(locationsTable).where(eq(locationsTable.id, id)).limit(1);
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
