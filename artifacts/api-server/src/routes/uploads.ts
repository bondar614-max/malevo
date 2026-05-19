import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

const router: IRouter = Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.resolve(__dirname, "..", "public", "uploads");
fs.mkdirSync(uploadsDir, { recursive: true });

async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.auth) { res.status(401).json({ error: "Unauthorized" }); return; }
  const rows = await db.select({ role: usersTable.role }).from(usersTable).where(eq(usersTable.id, req.auth.userId)).limit(1);
  if (rows[0]?.role !== "admin") { res.status(403).json({ error: "Forbidden" }); return; }
  next();
}

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase().replace(/[^.a-z0-9]/g, "") || ".png";
    const safeExt = [".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(ext) ? ext : ".png";
    cb(null, `${Date.now()}_${crypto.randomBytes(6).toString("hex")}${safeExt}`);
  },
});

const upload = multer({
  storage,
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

router.post("/admin/uploads", requireAuth, requireAdmin, handleUpload, (req, res) => {
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  if (files.length === 0) {
    res.status(400).json({ error: "Файлы не загружены" });
    return;
  }
  const urls = files.map((f) => `/api/static/uploads/${f.filename}`);
  res.json({ urls });
});

export default router;
