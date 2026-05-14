import { Router, type IRouter } from "express";
import { db, stylesTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

const router: IRouter = Router();

router.get("/stats/summary", async (_req, res) => {
  const rows = await db
    .select({
      totalStyles: sql<number>`count(*)::int`,
      totalGenerated: sql<number>`coalesce(sum(${stylesTable.ordersCount}),0)::int`,
      averageRating: sql<number>`coalesce(avg(${stylesTable.rating}),4.9)::float`,
      averageGenerationTime: sql<number>`coalesce(avg(${stylesTable.generationTime}),60)::int`,
    })
    .from(stylesTable)
    .where(eq(stylesTable.isActive, true));
  const r = rows[0]!;
  res.json({
    totalStyles: r.totalStyles,
    totalGenerated: r.totalGenerated,
    averageRating: Math.round(r.averageRating * 10) / 10,
    averageGenerationTime: r.averageGenerationTime,
  });
});

export default router;
