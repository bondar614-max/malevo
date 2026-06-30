import { mysqlTable, varchar, text, int, boolean, decimal, json } from "drizzle-orm/mysql-core";
import { dateTimeColumn, uuidColumn } from "./_helpers";

export const servicesTable = mysqlTable("services", {
  key: varchar("key", { length: 64 }).primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  shortDescription: text("short_description").notNull().default(""),
  fullDescription: text("full_description").notNull().default(""),
  prompt: text("prompt").notNull().default(""),
  previewImageUrl: varchar("preview_image_url", { length: 500 }).notNull().default(""),
  price: decimal("price", { precision: 10, scale: 2 }).notNull().default("0"),
  photosMin: int("photos_min").notNull().default(1),
  photosMax: int("photos_max").notNull().default(1),
  generationTime: int("generation_time").notNull().default(60),
  isActive: boolean("is_active").notNull().default(true),
  accentFrom: varchar("accent_from", { length: 32 }).notNull().default("#7C3AED"),
  accentTo: varchar("accent_to", { length: 32 }).notNull().default("#EC4899"),
  badge: varchar("badge", { length: 64 }).notNull().default(""),
  sortOrder: int("sort_order").notNull().default(0),
  createdAt: dateTimeColumn("created_at").notNull().defaultNow(),
});

export const locationsTable = mysqlTable("locations", {
  id: uuidColumn("id").primaryKey(),
  serviceKey: varchar("service_key", { length: 64 }).references(() => servicesTable.key, { onDelete: "cascade" }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  previewImageUrl: varchar("preview_image_url", { length: 500 }).notNull().default(""),
  promptFragment: text("prompt_fragment").notNull().default(""),
  prompts: json("prompts").$type<string[]>().notNull().default([]),
  sortOrder: int("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: dateTimeColumn("created_at").notNull().defaultNow(),
});

export type Service = typeof servicesTable.$inferSelect;
export type Location = typeof locationsTable.$inferSelect;
