import { pgTable, uuid, varchar, text, integer, boolean, timestamp, numeric } from "drizzle-orm/pg-core";

export const tariffsTable = pgTable("tariffs", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description").notNull().default(""),
  price: numeric("price", { precision: 10, scale: 2 }).notNull().default("0"),
  generationsIncluded: integer("generations_included").notNull().default(1),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Tariff = typeof tariffsTable.$inferSelect;
