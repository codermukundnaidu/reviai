import { EventEmitter } from "node:events";
import { randomUUID } from "node:crypto";
import { saveProject, now, type Project } from "./project-store";

export type ProjectEvent = NonNullable<Project["events"]>[number];
const hub = new EventEmitter();
hub.setMaxListeners(100);

export function subscribeToProject(id: string, listener: (event: ProjectEvent) => void) {
  hub.on(id, listener);
  return () => { hub.off(id, listener); };
}

/** Persist before publishing so reconnects and other tabs can replay real events. */
export async function recordProjectEvent(
  project: Project, owner: string, type: ProjectEvent["type"], detail: string,
) {
  const event: ProjectEvent = { id: randomUUID(), projectId: project.id, type, detail, createdAt: now() };
  project.events = [...(project.events ?? []), event].slice(-2000);
  await saveProject(project, owner);
  hub.emit(project.id, event);
  return event;
}
