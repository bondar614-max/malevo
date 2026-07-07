import { mysqlTable, varchar, decimal, text } from "drizzle-orm/mysql-core";
import { dateTimeColumn, uuidColumn } from "./_helpers";
import { usersTable } from "./users";

export const balancePaymentsTable = mysqlTable("balance_payments", {
  id: uuidColumn("id").primaryKey(),
  userId: varchar("user_id", { length: 36 }).notNull().references(() => usersTable.id),
  yookassaPaymentId: varchar("yookassa_payment_id", { length: 255 }).unique(),
  status: varchar("status", { length: 50 }).notNull().default("pending"),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).notNull().default("RUB"),
  confirmationUrl: text("confirmation_url"),
  description: varchar("description", { length: 255 }).notNull().default("Пополнение баланса"),
  creditedAt: dateTimeColumn("credited_at"),
  createdAt: dateTimeColumn("created_at").notNull().defaultNow(),
  updatedAt: dateTimeColumn("updated_at").notNull().defaultNow(),
});

export type BalancePayment = typeof balancePaymentsTable.$inferSelect;
