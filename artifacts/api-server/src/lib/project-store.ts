import { randomUUID } from "node:crypto";
import { and, eq, desc } from "drizzle-orm";
import { db, projectsTable } from "@workspace/db";
import { GetProjectResponse } from "@workspace/api-zod";
import { z } from "zod";

export type Project = z.infer<typeof GetProjectResponse>;
export const now = () => new Date().toISOString();
export async function loadProject(id: string, owner: string): Promise<Project | undefined> {
  const [row] = await db.select().from(projectsTable)
    .where(and(eq(projectsTable.id, id), eq(projectsTable.owner, owner)));
  return row ? GetProjectResponse.parse(row.payload) : undefined;
}
export async function listProjects(owner: string): Promise<Project[]> {
  const rows = await db.select().from(projectsTable).where(eq(projectsTable.owner, owner))
    .orderBy(desc(projectsTable.updatedAt)).limit(50);
  return rows.map(row => GetProjectResponse.parse(row.payload));
}
export async function saveProject(project: Project, owner: string): Promise<void> {
  project.updatedAt = now();
  const payload = GetProjectResponse.parse(project);
  await db.insert(projectsTable).values({ id: project.id, owner, payload, updatedAt: new Date() })
    .onConflictDoUpdate({ target: projectsTable.id, set: { payload, updatedAt: new Date() },
      setWhere: eq(projectsTable.owner, owner) });
}
export function activity(project: Project, title: string, detail: string, status: Project["activities"][number]["status"]) {
  const event = { id: randomUUID(), title, detail, status, createdAt: now() };
  project.activities.push(event);
  return event;
}
export function message(project: Project, role: "user" | "assistant", content: string) {
  project.messages.push({ id: randomUUID(), role, content, createdAt: now() });
}
