import { Router, type IRouter } from "express";
import { db, reviewsTable } from "@workspace/db";
import { desc } from "drizzle-orm";

const router: IRouter = Router();

router.get("/reviews", async (_req, res) => {
  const rows = await db.select().from(reviewsTable).orderBy(desc(reviewsTable.createdAt));
  res.json(
    rows.map((r) => ({
      id: r.id,
      name: r.name,
      avatarColor: r.avatarColor,
      rating: r.rating,
      text: r.text,
      styleTag: r.styleTag,
      createdAt: r.createdAt.toISOString(),
    })),
  );
});

export default router;
