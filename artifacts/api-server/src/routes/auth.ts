import { Router, type IRouter } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { RegisterBody, LoginBody } from "@workspace/api-zod";
import { hashPassword, comparePassword, signToken, requireAuth } from "../lib/auth";

const router: IRouter = Router();

function userResponse(u: typeof usersTable.$inferSelect) {
  return {
    id: u.id,
    email: u.email,
    name: u.name ?? "",
    role: u.role,
    createdAt: u.createdAt.toISOString(),
  };
}

router.post("/auth/register", async (req, res) => {
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const { email, name, password } = parsed.data;
  const existing = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (existing.length > 0) {
    res.status(409).json({ error: "Email already registered" });
    return;
  }
  const passwordHash = await hashPassword(password);
  const [user] = await db
    .insert(usersTable)
    .values({ email, name: name ?? null, passwordHash })
    .returning();
  const token = signToken({ userId: user!.id, email: user!.email });
  res.status(201).json({ token, user: userResponse(user!) });
});

router.post("/auth/login", async (req, res) => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const { email, password } = parsed.data;
  const rows = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  const user = rows[0];
  if (!user) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }
  const ok = await comparePassword(password, user.passwordHash);
  if (!ok) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }
  await db.update(usersTable).set({ lastLogin: new Date() }).where(eq(usersTable.id, user.id));
  const token = signToken({ userId: user.id, email: user.email });
  res.json({ token, user: userResponse(user) });
});

router.get("/auth/me", requireAuth, async (req, res) => {
  const rows = await db.select().from(usersTable).where(eq(usersTable.id, req.auth!.userId)).limit(1);
  const user = rows[0];
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  res.json(userResponse(user));
});

export default router;
