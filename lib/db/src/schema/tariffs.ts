import { mysqlTable, varchar, text, int, boolean, decimal } from "drizzle-orm/mysql-core";
import { dateTimeColumn, uuidColumn } from "./_helpers";

export const tariffsTable = mysqlTable("tariffs", {
  id: uuidColumn("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description").notNull().default(""),
  price: decimal("price", { precision: 10, scale: 2 }).notNull().default("0"),
  generationsIncluded: int("generations_included").notNull().default(1),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: int("sort_order").notNull().default(0),
  createdAt: dateTimeColumn("created_at").notNull().defaultNow(),
});

export type Tariff = typeof tariffsTable.$inferSelect;
