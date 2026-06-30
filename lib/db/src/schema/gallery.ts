import { mysqlTable, varchar, int } from "drizzle-orm/mysql-core";
import { dateTimeColumn, uuidColumn } from "./_helpers";
import { stylesTable } from "./styles";

export const galleryTable = mysqlTable("gallery", {
  id: uuidColumn("id").primaryKey(),
  imageUrl: varchar("image_url", { length: 500 }).notNull(),
  styleId: varchar("style_id", { length: 36 }).references(() => stylesTable.id).notNull(),
  styleTitle: varchar("style_title", { length: 255 }).notNull(),
  sortOrder: int("sort_order").notNull().default(0),
  createdAt: dateTimeColumn("created_at").notNull().defaultNow(),
});

export type GalleryItem = typeof galleryTable.$inferSelect;
