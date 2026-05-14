import { Router, type IRouter } from "express";
import { db, galleryTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/gallery", async (_req, res) => {
  const rows = await db.select().from(galleryTable).orderBy(galleryTable.sortOrder);
  res.json(
    rows.map((g) => ({
      id: g.id,
      imageUrl: g.imageUrl,
      styleTitle: g.styleTitle,
      styleId: g.styleId,
    })),
  );
});

export default router;
