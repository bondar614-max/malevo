import { pgTable, uuid, varchar, text, integer, boolean, timestamp, numeric, jsonb } from "drizzle-orm/pg-core";

export const servicesTable = pgTable("services", {
  key: varchar("key", { length: 64 }).primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  shortDescription: text("short_description").notNull().default(""),
  fullDescription: text("full_description").notNull().default(""),
  prompt: text("prompt").notNull().default(""),
  previewImageUrl: varchar("preview_image_url", { length: 500 }).notNull().default(""),
  price: numeric("price", { precision: 10, scale: 2 }).notNull().default("0"),
  photosMin: integer("photos_min").notNull().default(1),
  photosMax: integer("photos_max").notNull().default(1),
  generationTime: integer("generation_time").notNull().default(60),
  isActive: boolean("is_active").notNull().default(true),
  accentFrom: varchar("accent_from", { length: 32 }).notNull().default("#7C3AED"),
  accentTo: varchar("accent_to", { length: 32 }).notNull().default("#EC4899"),
  badge: varchar("badge", { length: 64 }).notNull().default(""),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const locationsTable = pgTable("locations", {
  id: uuid("id").primaryKey().defaultRandom(),
  serviceKey: varchar("service_key", { length: 64 }).references(() => servicesTable.key, { onDelete: "cascade" }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  previewImageUrl: varchar("preview_image_url", { length: 500 }).notNull().default(""),
  promptFragment: text("prompt_fragment").notNull().default(""),
  prompts: jsonb("prompts").$type<string[]>().notNull().default([]),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Service = typeof servicesTable.$inferSelect;
export type Location = typeof locationsTable.$inferSelect;
