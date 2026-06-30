import { mysqlTable, varchar, boolean, decimal } from "drizzle-orm/mysql-core";
import { dateTimeColumn, uuidColumn } from "./_helpers";

export const usersTable = mysqlTable("users", {
  id: uuidColumn("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  role: varchar("role", { length: 50 }).notNull().default("user"),
  isBlocked: boolean("is_blocked").notNull().default(false),
  balance: decimal("balance", { precision: 10, scale: 2 }).notNull().default("0"),
  totalSpent: decimal("total_spent", { precision: 10, scale: 2 }).notNull().default("0"),
  createdAt: dateTimeColumn("created_at").notNull().defaultNow(),
  lastLogin: dateTimeColumn("last_login"),
});

export type User = typeof usersTable.$inferSelect;
