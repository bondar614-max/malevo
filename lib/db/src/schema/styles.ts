import { pgTable, uuid, varchar, text, integer, boolean, timestamp, jsonb, numeric } from "drizzle-orm/pg-core";

export const stylesTable = pgTable("styles", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: varchar("title", { length: 255 }).notNull(),
  shortDescription: text("short_description").notNull(),
  fullDescription: text("full_description").notNull(),
  prompt: text("prompt").notNull().default(""),
  negativePrompt: text("negative_prompt").notNull().default(""),
  price: numeric("price", { precision: 10, scale: 2 }).notNull().default("0"),
  previewImageUrl: varchar("preview_image_url", { length: 500 }).notNull(),
  referencePhotoUrl: varchar("reference_photo_url", { length: 500 }).notNull().default(""),
  exampleImages: jsonb("example_images").$type<string[]>().notNull().default([]),
  generationTime: integer("generation_time").notNull().default(60),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  ordersCount: integer("orders_count").notNull().default(0),
  photosRequired: integer("photos_required").notNull().default(1),
  category: varchar("category", { length: 100 }).notNull(),
  rating: numeric("rating", { precision: 3, scale: 2 }).notNull().default("4.9"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Style = typeof stylesTable.$inferSelect;
