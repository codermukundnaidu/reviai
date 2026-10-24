import { Router, type IRouter } from "express";
import { loadProject } from "../lib/project-store";
import { subscribeToProject, type ProjectEvent } from "../lib/project-events";

const router: IRouter = Router();
const connections = new Map<string, number>();
router.get("/projects/:id/events", async (req, res) => {
  const id = String(req.params.id);
  const owner = res.locals.owner as string;
  const existing = await loadProject(id, owner);
  if (!existing) { res.status(404).json({ error: "Project not found in this browser." }); return; }
  if ((connections.get(owner) ?? 0) >= 8) { res.status(429).end(); return; }
  connections.set(owner, (connections.get(owner) ?? 0) + 1);
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();
  let replaying = true;
  let closed = false;
  const queued: ProjectEvent[] = [];
  const sent = new Set<string>();
  const send = (event: ProjectEvent) => {
    if (closed || sent.has(event.id)) return;
    sent.add(event.id);
    res.write(`id: ${event.id}\nevent: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
  };
  const unsubscribe = subscribeToProject(id, event => replaying ? queued.push(event) : send(event));
  const heartbeat = setInterval(() => { if (!closed) res.write(": heartbeat\n\n"); }, 15000);
  req.on("close", () => {
    closed = true; clearInterval(heartbeat); unsubscribe();
    const n = (connections.get(owner) ?? 1) - 1;
    if (n) connections.set(owner, n); else connections.delete(owner);
  });
  try {
    // Subscribe first, then replay the persisted snapshot so concurrent events cannot be lost.
    const project = await loadProject(id, owner);
    if (!project || closed) { res.end(); return; }
    res.write(`event: snapshot\ndata: ${JSON.stringify(project)}\n\n`);
    const events = project.events ?? [];
    const last = req.get("Last-Event-ID");
    const index = last ? events.findIndex(event => event.id === last) : -1;
    if (index >= 0) for (const event of events.slice(0, index + 1)) sent.add(event.id);
    for (const event of events.slice(index + 1)) send(event);
    replaying = false;
    for (const event of queued) send(event);
  } catch { res.end(); }
});
export default router;
