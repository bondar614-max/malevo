import { mysqlTable, varchar, text, json, boolean } from "drizzle-orm/mysql-core";
import { dateTimeColumn, uuidColumn } from "./_helpers";
import { usersTable } from "./users";

export type SupportMessage = {
  role: "user" | "assistant" | "admin";
  content: string;
  createdAt: string;
};

export const supportTicketsTable = mysqlTable("support_tickets", {
  id: uuidColumn("id").primaryKey(),
  userId: varchar("user_id", { length: 36 }).references(() => usersTable.id, { onDelete: "cascade" }).notNull(),
  status: varchar("status", { length: 32 }).notNull().default("collecting"),
  topic: varchar("topic", { length: 255 }).notNull().default("Новое обращение"),
  summary: text("summary").notNull().default(""),
  messages: json("messages").$type<SupportMessage[]>().notNull().default([]),
  isUnread: boolean("is_unread").notNull().default(false),
  createdAt: dateTimeColumn("created_at").notNull().defaultNow(),
  updatedAt: dateTimeColumn("updated_at").notNull().defaultNow(),
});

export type SupportTicket = typeof supportTicketsTable.$inferSelect;
