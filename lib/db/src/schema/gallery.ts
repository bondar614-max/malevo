import { pgTable, uuid, varchar, integer, timestamp } from "drizzle-orm/pg-core";
import { stylesTable } from "./styles";

export const galleryTable = pgTable("gallery", {
  id: uuid("id").primaryKey().defaultRandom(),
  imageUrl: varchar("image_url", { length: 500 }).notNull(),
  styleId: uuid("style_id").references(() => stylesTable.id).notNull(),
  styleTitle: varchar("style_title", { length: 255 }).notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type GalleryItem = typeof galleryTable.$inferSelect;
