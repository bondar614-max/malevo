import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { requireAuth } from "../lib/auth";
import {
  listImageModels,
  getAllCategoryModels,
  setCategoryModel,
  type GenCategory,
} from "../lib/imageGen";

const router: IRouter = Router();

async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.auth) { res.status(401).json({ error: "Unauthorized" }); return; }
  const rows = await db.select({ role: usersTable.role }).from(usersTable).where(eq(usersTable.id, req.auth.userId)).limit(1);
  if (rows[0]?.role !== "admin") { res.status(403).json({ error: "Forbidden" }); return; }
  next();
}

router.get("/admin/ai/models", requireAuth, requireAdmin, async (_req, res) => {
  res.json(await listImageModels());
});

router.get("/admin/ai/settings", requireAuth, requireAdmin, async (_req, res) => {
  res.json(await getAllCategoryModels());
});

const SettingsSchema = z.object({
  styles: z.string().min(1).optional(),
  photoshoot: z.string().min(1).optional(),
  review: z.string().min(1).optional(),
});

router.patch("/admin/ai/settings", requireAuth, requireAdmin, async (req, res) => {
  const parsed = SettingsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const categories: GenCategory[] = ["styles", "photoshoot", "review"];
  for (const c of categories) {
    const v = parsed.data[c];
    if (typeof v === "string") await setCategoryModel(c, v);
  }
  res.json(await getAllCategoryModels());
});

export default router;
