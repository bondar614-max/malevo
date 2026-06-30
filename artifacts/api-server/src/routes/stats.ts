import { Router, type IRouter } from "express";
import { db, stylesTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

const router: IRouter = Router();

router.get("/stats/summary", async (_req, res) => {
  const rows = await db
    .select({
      totalStyles: sql<number>`count(*)`,
      totalGenerated: sql<number>`coalesce(sum(${stylesTable.ordersCount}),0)`,
      averageRating: sql<number>`coalesce(avg(${stylesTable.rating}),4.9)`,
      averageGenerationTime: sql<number>`coalesce(avg(${stylesTable.generationTime}),60)`,
    })
    .from(stylesTable)
    .where(eq(stylesTable.isActive, true));
  const r = rows[0]!;
  res.json({
    totalStyles: Number(r.totalStyles),
    totalGenerated: Number(r.totalGenerated),
    averageRating: Math.round(Number(r.averageRating) * 10) / 10,
    averageGenerationTime: Number(r.averageGenerationTime),
  });
});

export default router;
