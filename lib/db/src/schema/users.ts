import { pgTable, uuid, varchar, boolean, timestamp, numeric } from "drizzle-orm/pg-core";

export const usersTable = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  role: varchar("role", { length: 50 }).notNull().default("user"),
  isBlocked: boolean("is_blocked").notNull().default(false),
  balance: numeric("balance", { precision: 10, scale: 2 }).notNull().default("0"),
  totalSpent: numeric("total_spent", { precision: 10, scale: 2 }).notNull().default("0"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastLogin: timestamp("last_login", { withTimezone: true }),
});

export type User = typeof usersTable.$inferSelect;
