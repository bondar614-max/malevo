import { Router, type IRouter } from "express";
import { db, stylesTable } from "@workspace/db";
import { eq, and, desc, sql } from "drizzle-orm";

const router: IRouter = Router();

function serialize(s: typeof stylesTable.$inferSelect) {
  return {
    id: s.id,
    title: s.title,
    shortDescription: s.shortDescription,
    fullDescription: s.fullDescription,
    previewImageUrl: s.previewImageUrl,
    exampleImages: s.exampleImages ?? [],
    price: Number(s.price),
    generationTime: s.generationTime,
    ordersCount: s.ordersCount,
    category: s.category,
    rating: Number(s.rating),
    photosRequired: s.photosRequired,
  };
}

router.get("/styles", async (req, res) => {
  const category = typeof req.query.category === "string" ? req.query.category : undefined;
  const where = category && category !== "Все"
    ? and(eq(stylesTable.isActive, true), eq(stylesTable.category, category))
    : eq(stylesTable.isActive, true);
  const rows = await db.select().from(stylesTable).where(where).orderBy(stylesTable.sortOrder);
  res.json(rows.map(serialize));
});

router.get("/styles/categories", async (_req, res) => {
  const rows = await db
    .select({ category: stylesTable.category, count: sql<number>`count(*)` })
    .from(stylesTable)
    .where(eq(stylesTable.isActive, true))
    .groupBy(stylesTable.category);
  res.json(rows.map((row) => ({ ...row, count: Number(row.count) })));
});

router.get("/styles/trending", async (_req, res) => {
  const rows = await db
    .select()
    .from(stylesTable)
    .where(eq(stylesTable.isActive, true))
    .orderBy(desc(stylesTable.ordersCount))
    .limit(6);
  res.json(rows.map(serialize));
});

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
router.get("/styles/:id", async (req, res) => {
  if (!UUID_RE.test(req.params.id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const rows = await db.select().from(stylesTable).where(eq(stylesTable.id, req.params.id)).limit(1);
  if (rows.length === 0) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(serialize(rows[0]!));
});

export default router;
