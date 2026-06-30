import { mysqlTable, varchar, text, int, boolean, json, decimal } from "drizzle-orm/mysql-core";
import { dateTimeColumn, uuidColumn } from "./_helpers";

export const stylesTable = mysqlTable("styles", {
  id: uuidColumn("id").primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  shortDescription: text("short_description").notNull(),
  fullDescription: text("full_description").notNull(),
  prompt: text("prompt").notNull().default(""),
  negativePrompt: text("negative_prompt").notNull().default(""),
  price: decimal("price", { precision: 10, scale: 2 }).notNull().default("0"),
  previewImageUrl: varchar("preview_image_url", { length: 500 }).notNull(),
  referencePhotoUrl: varchar("reference_photo_url", { length: 500 }).notNull().default(""),
  exampleImages: json("example_images").$type<string[]>().notNull().default([]),
  generationTime: int("generation_time").notNull().default(60),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: int("sort_order").notNull().default(0),
  ordersCount: int("orders_count").notNull().default(0),
  photosRequired: int("photos_required").notNull().default(1),
  category: varchar("category", { length: 100 }).notNull(),
  rating: decimal("rating", { precision: 3, scale: 2 }).notNull().default("4.9"),
  createdAt: dateTimeColumn("created_at").notNull().defaultNow(),
});

export type Style = typeof stylesTable.$inferSelect;
