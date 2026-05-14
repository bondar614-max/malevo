import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";

const JWT_SECRET = process.env.SESSION_SECRET || process.env.JWT_SECRET;
if (!JWT_SECRET) {
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET (or JWT_SECRET) must be set in production");
  }
  // eslint-disable-next-line no-console
  console.warn("[auth] SESSION_SECRET not set; using insecure dev fallback");
}
const SECRET: string = JWT_SECRET || "dev-only-insecure-secret";

export interface JwtPayload {
  userId: string;
  email: string;
}

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, SECRET, { expiresIn: "30d" });
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, SECRET) as JwtPayload;
  } catch {
    return null;
  }
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: JwtPayload;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const token = header.slice("Bearer ".length);
  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  req.auth = payload;
  next();
}
