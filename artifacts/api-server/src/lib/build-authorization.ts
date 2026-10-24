import { randomUUID } from "node:crypto";
import type { Project } from "./project-store";

const authorizationTitles = new Set(["Plan auto-approved", "Plan approved"]);

export function hasBuildAuthorization(project: Project) {
  return project.activities.some(event =>
    authorizationTitles.has(event.title) && event.status === "completed");
}

/** Apply the user's automatic-build preference to a validated, ready plan. */
export function autoApprovePlan(project: Project) {
  if (!project.plan || !["discovering", "awaiting-approval"].includes(project.status)) return false;

  for (const event of project.activities) {
    if (event.status === "awaiting-approval") event.status = "completed";
  }
  project.activities.push({
    id: randomUUID(),
    title: "Plan auto-approved",
    detail: "The validated plan is authorized for Revi's controlled build. This does not publish or deploy the app.",
    status: "completed",
    createdAt: new Date().toISOString(),
  });
  project.status = "building";
  project.tests = [];
  project.prototype = undefined;
  project.reviewApproved = false;
  return true;
}
