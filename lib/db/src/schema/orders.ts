import { mysqlTable, varchar, text, json, decimal, int } from "drizzle-orm/mysql-core";
import { dateTimeColumn, uuidColumn } from "./_helpers";
import { usersTable } from "./users";
import { stylesTable } from "./styles";
import { servicesTable, locationsTable } from "./services";

export const ordersTable = mysqlTable("orders", {
  id: uuidColumn("id").primaryKey(),
  userId: varchar("user_id", { length: 36 }).references(() => usersTable.id),
  styleId: varchar("style_id", { length: 36 }).references(() => stylesTable.id),
  serviceKey: varchar("service_key", { length: 64 }).references(() => servicesTable.key),
  locationId: varchar("location_id", { length: 36 }).references(() => locationsTable.id),
  status: varchar("status", { length: 50 }).notNull().default("pending"),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull().default("0"),
  sourcePhotoUrl: varchar("source_photo_url", { length: 500 }),
  sourcePhotos: json("source_photos").$type<string[]>().notNull().default([]),
  resultPhotos: json("result_photos").$type<string[]>().notNull().default([]),
  kieTaskId: varchar("kie_task_id", { length: 255 }),
  kieTaskIds: json("kie_task_ids").$type<string[]>().notNull().default([]),
  paymentId: varchar("payment_id", { length: 255 }),
  errorMessage: text("error_message"),
  // Review (n8n) order inputs and progress tracking
  item: varchar("item", { length: 255 }),
  gender: varchar("gender", { length: 32 }),
  age: varchar("age", { length: 32 }),
  sets: int("sets"),
  expectedPhotos: int("expected_photos").notNull().default(0),
  receivedPhotoNumbers: json("received_photo_numbers").$type<number[]>().notNull().default([]),
  approvalMode: varchar("approval_mode", { length: 32 }),
  anchorPhotoUrl: varchar("anchor_photo_url", { length: 500 }),
  approvalComment: text("approval_comment"),
  revisionCount: int("revision_count").notNull().default(0),
  photoshootPrompt: text("photoshoot_prompt"),
  createdAt: dateTimeColumn("created_at").notNull().defaultNow(),
  completedAt: dateTimeColumn("completed_at"),
});

export type Order = typeof ordersTable.$inferSelect;
