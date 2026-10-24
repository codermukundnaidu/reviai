import { pgTable, text, integer, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

export const bakeryOrdersTable = pgTable("buildbuddy_bakery_orders", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull(),
  customerName: text("customer_name").notNull(),
  items: text("items").notNull(),
  quantity: integer("quantity").notNull(),
  pickupDate: text("pickup_date").notNull(),
  status: text("status").notNull(),
  version: integer("version").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [index("buildbuddy_orders_project_idx").on(table.projectId)]);
export const insertBakeryOrderSchema = createInsertSchema(bakeryOrdersTable);
export type StoredBakeryOrder = typeof bakeryOrdersTable.$inferSelect;
