import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { hashPassword } from "./auth";
import { logger } from "./logger";

/**
 * Ensure an admin user exists. Runs on server startup.
 *
 * If ADMIN_EMAIL + ADMIN_PASSWORD env vars are set:
 *   - Create the admin user if it doesn't exist.
 *   - If the user exists but isn't an admin, promote them to admin.
 *   - Never overwrites an existing password.
 *
 * Safe to run on every boot; idempotent.
 */
export async function ensureAdminUser(): Promise<void> {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) return;

  try {
    const existing = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email))
      .limit(1);

    if (existing.length === 0) {
      const passwordHash = await hashPassword(password);
      await db.insert(usersTable).values({
        email,
        passwordHash,
        name: "Admin",
        role: "admin",
        balance: "10000.00",
      });
      logger.info({ email }, "[bootstrap] created admin user");
      return;
    }

    const user = existing[0]!;
    if (user.role !== "admin") {
      await db.update(usersTable).set({ role: "admin" }).where(eq(usersTable.id, user.id));
      logger.info({ email }, "[bootstrap] promoted existing user to admin");
    }
  } catch (err) {
    logger.error({ err }, "[bootstrap] failed to ensure admin user");
  }
}
