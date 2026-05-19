import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import multer from "multer";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { uploadBufferToStorage } from "../lib/storage-helpers";

const router: IRouter = Router();

async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.auth) { res.status(401).json({ error: "Unauthorized" }); return; }
  const rows = await db.select({ role: usersTable.role }).from(usersTable).where(eq(usersTable.id, req.auth.userId)).limit(1);
  if (rows[0]?.role !== "admin") { res.status(403).json({ error: "Forbidden" }); return; }
  next();
}

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 10 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED.has(file.mimetype)) return cb(new Error("Только JPG/PNG/WebP/GIF"));
    cb(null, true);
  },
});

function handleUpload(req: Request, res: Response, next: NextFunction): void {
  upload.array("files", 10)(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") { res.status(413).json({ error: "Файл больше 10 МБ" }); return; }
      if (err.code === "LIMIT_FILE_COUNT") { res.status(400).json({ error: "Слишком много файлов (максимум 10)" }); return; }
      res.status(400).json({ error: err.message }); return;
    }
    if (err instanceof Error) { res.status(400).json({ error: err.message }); return; }
    next();
  });
}

router.post("/admin/uploads", requireAuth, requireAdmin, handleUpload, async (req, res) => {
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  if (files.length === 0) {
    res.status(400).json({ error: "Файлы не загружены" });
    return;
  }
  try {
    const urls = await Promise.all(
      files.map((f) => uploadBufferToStorage(f.buffer, f.mimetype, "admin")),
    );
    res.json({ urls });
  } catch (err) {
    req.log.error({ err }, "admin upload to object storage failed");
    res.status(500).json({ error: "Не удалось сохранить файл" });
  }
});

export default router;
