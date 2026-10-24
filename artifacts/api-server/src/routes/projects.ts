import { Router, type IRouter, type Request, type Response } from "express";
import cookieParser from "cookie-parser";
import { randomUUID } from "node:crypto";
import { accountAccess } from "../middlewares/account-access";
import {
  CreateProjectBody, SendMessageBody, ReviewProjectBody, GetProjectParams,
  CreateProjectResponse, GetProjectResponse, ListProjectsResponse,
  SendMessageResponse, ApprovePlanResponse, ReviewProjectResponse, GetIntegrationsResponse,
} from "@workspace/api-zod";
import { activity, message, loadProject, listProjects, saveProject, now, type Project } from "../lib/project-store";
import { clarify } from "../lib/buddy-agent";
import { isPlanningConfigured } from "../lib/buddy-agent";
import { AgenticOrgPlanningError } from "../lib/agenticorg-planner";
import { buildProject, busyProjects } from "../lib/build-project";
import { autoApprovePlan, hasBuildAuthorization } from "../lib/build-authorization";
import { recordProjectEvent } from "../lib/project-events";
import bakeryRouter from "./bakery";
import streamRouter from "./project-stream";

const router: IRouter = Router();
router.use(cookieParser());
router.use(accountAccess());
const rate = new Map<string, { count: number; reset: number }>();
router.use((req, res, next) => {
  if (!/^\/(projects|integrations)(\/|$)/.test(req.path)) { next(); return; }
  if (req.method !== "GET" && req.get("Sec-Fetch-Site") === "cross-site") {
    res.status(403).json({ error: "Cross-site writes are not allowed" }); return;
  }
  const owner = res.locals.owner as string;
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") {
    // Bound both per-browser and per-network calls to public paid AI endpoints.
    for (const key of [owner, `ip:${req.ip}`]) {
      const entry = rate.get(key);
      const budget = entry && entry.reset > Date.now() ? entry : { count: 0, reset: Date.now() + 60000 };
      budget.count++;
      rate.set(key, budget);
      if (budget.count > 20) { res.status(429).json({ error: "Please wait a minute before trying again." }); return; }
    }
    if (rate.size > 10000) for (const [key, entry] of rate) if (entry.reset < Date.now()) rate.delete(key);
  }
  next();
});
router.use(streamRouter);
router.use(bakeryRouter);

async function find(req: Request, res: Response): Promise<Project | undefined> {
  const parsed = GetProjectParams.safeParse(req.params);
  if (!parsed.success) { res.status(400).json({ error: "Invalid project ID" }); return; }
  const project = await loadProject(parsed.data.id, res.locals.owner);
  if (!project) res.status(404).json({ error: "Project not found in your account" });
  return project;
}
function available(project: Project, res: Response) {
  if (busyProjects.has(project.id)) {
    res.status(409).json({ error: "This project is still working. Please wait for it to finish." }); return false;
  }
  return true;
}
router.get("/integrations", (_req, res) => {
  res.json(GetIntegrationsResponse.parse({
    ai: isPlanningConfigured(),
    agenticOrg: isPlanningConfigured(),
    voice: true,
  }));
});
router.get("/projects", async (_req, res): Promise<void> => {
  res.json(ListProjectsResponse.parse(await listProjects(res.locals.owner)));
});
router.post("/projects", async (req, res): Promise<void> => {
  const parsed = CreateProjectBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Select a valid experience level" }); return; }
  if ((await listProjects(res.locals.owner)).length >= 50) {
    res.status(429).json({ error: "This browser has reached the 50 project limit." }); return;
  }
  const project: Project = { id: randomUUID(), title: "Untitled idea", level: parsed.data.level,
    status: "discovering", requirements: { goal: "", audience: "", constraints: [], questions: ["What would you like to accomplish?"] },
    messages: [], activities: [], tests: [], reviewApproved: false, createdAt: now(), updatedAt: now() };
  message(project, "assistant", "Hi, I'm BuildBuddy. Tell me what you're trying to accomplish—in your own words. You don't need to know what to build yet.");
  activity(project, "Conversation started", `${project.level} experience selected. No plan or prototype has been generated.`, "completed");
  await saveProject(project, res.locals.owner);
  res.status(201).json(CreateProjectResponse.parse(project));
});
router.get("/projects/:id", async (req, res): Promise<void> => {
  const project = await find(req, res);
  if (!project) return;
  // Existing ready-to-build plans from before automatic approval are migrated
  // lazily on their owner's next visit. Provider-review holds have no plan and
  // cannot pass this check.
  if (!busyProjects.has(project.id) && autoApprovePlan(project)) {
    busyProjects.add(project.id);
    try {
      await saveProject(project, res.locals.owner);
      await recordProjectEvent(project, res.locals.owner, "plan_ready", "Previously validated plan automatically authorized; starting the controlled build.");
      void buildProject(project, res.locals.owner);
    } catch (error) {
      busyProjects.delete(project.id);
      throw error;
    }
  }
  res.json(GetProjectResponse.parse(project));
});
router.post("/projects/:id/messages", async (req, res): Promise<void> => {
  const parsed = SendMessageBody.safeParse(req.body);
  if (!parsed.success || !parsed.data.content.trim()) { res.status(400).json({ error: "Enter a message (up to 10,000 characters)" }); return; }
  const project = await find(req, res);
  if (!project || !available(project, res)) return;
  if (!isPlanningConfigured()) {
    res.status(503).json({ error: "AgenticOrg planning is not configured. A server-only key and planner UUID are required." });
    return;
  }
  busyProjects.add(project.id);
  let buildInProgress = false;
  message(project, "user", parsed.data.content.trim());
  // Any new requirements invalidate prior plan authorization and test results.
  project.plan = undefined;
  project.prototype = undefined;
  project.tests = [];
  project.reviewApproved = false;
  project.status = "discovering";
  for (const event of project.activities) if (event.status === "awaiting-approval") {
    event.status = "completed"; event.detail += " Superseded by a new conversation turn.";
  }
  const event = activity(project, "Understanding your idea", "Requesting a proposal from the configured AgenticOrg planner. A build starts only after a complete plan passes validation.", "running");
  try {
    await saveProject(project, res.locals.owner);
    const result = await clarify(project);
    project.title = result.title;
    project.requirements = result.requirements;
    project.plan = result.plan ?? undefined;
    project.status = result.plan ? "awaiting-approval" : "discovering";
    message(project, "assistant", result.reply);
    event.status = "completed";
    event.detail = "AgenticOrg plan passed strict response and workflow validation.";
    if (result.plan) {
      if (!autoApprovePlan(project)) throw new Error("The validated plan could not be authorized for its controlled build.");
      await recordProjectEvent(project, res.locals.owner, "plan_ready", "AgenticOrg returned a completed proposal that passed response and workflow validation.");
      buildInProgress = true;
      void buildProject(project, res.locals.owner);
    } else await saveProject(project, res.locals.owner);
    res.json(SendMessageResponse.parse(project));
  } catch (err) {
    req.log.error({ errorType: err instanceof Error ? err.name : "UnknownError", projectId: project.id }, "AI planning failed");
    const detail = err instanceof AgenticOrgPlanningError ? err.message : "Planning failed or returned invalid data. No plan was approved.";
    event.status = err instanceof AgenticOrgPlanningError && err.code === "review_required" ? "awaiting-approval" : "failed";
    event.detail = detail;
    message(project, "assistant", `${detail} Your conversation has been saved.`);
    if (err instanceof AgenticOrgPlanningError && err.code === "review_required") {
      project.status = "awaiting-approval";
      await recordProjectEvent(project, res.locals.owner, "approval_required", detail);
    } else await saveProject(project, res.locals.owner);
    res.status(502).json({ error: detail });
  } finally { if (!buildInProgress) busyProjects.delete(project.id); }
});
router.post("/projects/:id/approve", async (req, res): Promise<void> => {
  const project = await find(req, res);
  if (!project || !available(project, res)) return;
  if (!project.plan || !["awaiting-approval", "failed"].includes(project.status)) {
    res.status(409).json({ error: "A proposed plan is required before approval." }); return;
  }
  busyProjects.add(project.id);
  try {
    for (const event of project.activities) if (event.status === "awaiting-approval") event.status = "completed";
    if (!hasBuildAuthorization(project)) {
      activity(project, "Plan auto-approved", "This validated plan is authorized under Revi's automatic-build setting. No deployment or external account changes authorized.", "completed");
    }
    project.status = "building";
    project.tests = []; project.prototype = undefined; project.reviewApproved = false;
    await saveProject(project, res.locals.owner);
    res.json(ApprovePlanResponse.parse(project));
    void buildProject(project, res.locals.owner);
  } catch (err) { busyProjects.delete(project.id); throw err; }
});
router.post("/projects/:id/review", async (req, res): Promise<void> => {
  const parsed = ReviewProjectBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "A review decision is required" }); return; }
  const project = await find(req, res);
  if (!project || !available(project, res)) return;
  if (project.status !== "ready") { res.status(409).json({ error: "Only a ready prototype can be reviewed" }); return; }
  busyProjects.add(project.id);
  try {
    project.reviewApproved = parsed.data.approved;
    for (const event of project.activities) if (event.status === "awaiting-approval") event.status = "completed";
    activity(project, parsed.data.approved ? "Prototype approved" : "Changes requested",
      parsed.data.approved ? "You accepted this prototype. It has not been published or deployed." : "Continue the conversation to describe the changes you need.", "completed");
    await saveProject(project, res.locals.owner);
    res.json(ReviewProjectResponse.parse(project));
  } finally { busyProjects.delete(project.id); }
});
export default router;
