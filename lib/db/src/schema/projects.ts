import { pgTable, text, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const projectsTable = pgTable("buildbuddy_projects", {
  id: text("id").primaryKey(),
  owner: text("owner").notNull(),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("buildbuddy_projects_owner_idx").on(table.owner)]);
export const insertProjectSchema = createInsertSchema(projectsTable);
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type StoredProject = typeof projectsTable.$inferSelect;
