import { randomUUID } from "node:crypto";
import { and, eq, asc, count, sql } from "drizzle-orm";
import { db, bakeryOrdersTable as orders } from "@workspace/db";
import { CreateOrderBody, ListOrdersResponse } from "@workspace/api-zod";
import type { z } from "zod";

export class OrderError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
type Input = z.infer<typeof CreateOrderBody>;
export function validateOrderInput(value: unknown): Input {
  const result = CreateOrderBody.strict().safeParse(value);
  if (!result.success) throw new OrderError(400, "Provide customer, items, quantity, pickup date and a supported status.");
  const input = result.data;
  input.customerName = input.customerName.trim();
  input.items = input.items.trim();
  let validDate = false;
  try { validDate = new Date(`${input.pickupDate}T00:00:00Z`).toISOString().slice(0, 10) === input.pickupDate; } catch { /* Invalid date */ }
  if (!input.customerName || !input.items || !validDate) throw new OrderError(400, "Customer and items cannot be blank; pickup date must be a real calendar date.");
  return input;
}
function view(row: typeof orders.$inferSelect) {
  const { projectId: _, ...record } = row;
  return { ...record, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() };
}
export async function listBakeryOrders(projectId: string) {
  const rows = await db.select().from(orders).where(eq(orders.projectId, projectId))
    .orderBy(asc(orders.pickupDate), asc(orders.createdAt)).limit(500);
  return ListOrdersResponse.parse(rows.map(view));
}
export async function createBakeryOrder(projectId: string, value: unknown) {
  const { version: _, ...input } = validateOrderInput(value);
  return db.transaction(async tx => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${projectId}))`);
    const [size] = await tx.select({ n: count() }).from(orders).where(eq(orders.projectId, projectId));
    if (size.n >= 500) throw new OrderError(409, "This MVP supports up to 500 orders per project.");
    const [row] = await tx.insert(orders).values({ ...input, id: randomUUID(), projectId }).returning();
    return view(row);
  });
}
export async function updateBakeryOrder(projectId: string, id: string, value: unknown) {
  const { version, ...input } = validateOrderInput(value);
  if (!version) throw new OrderError(400, "The current order version is required.");
  const [row] = await db.update(orders).set({ ...input, version: sql`${orders.version} + 1`, updatedAt: new Date() })
    .where(and(eq(orders.projectId, projectId), eq(orders.id, id), eq(orders.version, version))).returning();
  if (!row) {
    const [exists] = await db.select({ id: orders.id }).from(orders).where(and(eq(orders.projectId, projectId), eq(orders.id, id)));
    throw new OrderError(exists ? 409 : 404, exists ? "This order changed in another tab. Refresh and review it before saving." : "Order not found.");
  }
  return view(row);
}
export async function deleteBakeryOrder(projectId: string, id: string, version: number) {
  const rows = await db.delete(orders).where(and(eq(orders.projectId, projectId), eq(orders.id, id), eq(orders.version, version))).returning({ id: orders.id });
  if (!rows.length) {
    const [exists] = await db.select({ id: orders.id }).from(orders).where(and(eq(orders.projectId, projectId), eq(orders.id, id)));
    throw new OrderError(exists ? 409 : 404, exists ? "This order changed. Refresh before deleting it." : "Order not found.");
  }
}
/** Build verification uses an unrouteable, unique namespace, never live order records. */
export async function cleanVerificationOrders(scope: string) {
  if (!scope.startsWith("__verification_")) throw new Error("Invalid verification scope");
  await db.delete(orders).where(eq(orders.projectId, scope));
}
