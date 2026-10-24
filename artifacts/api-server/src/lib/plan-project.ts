import { randomUUID } from "node:crypto";
import { PlanProjectResponse, type PlanningInput } from "@workspace/api-zod";
import { clarify } from "./buddy-agent";
import type { Project } from "./project-store";

/** Read-only planner. No browser ownership, persistence, approval, or build side effects. */
export async function planFromIdea(input: PlanningInput) {
  const timestamp = new Date().toISOString();
  const project: Project = {
    id: randomUUID(), title: "Voice planning request", level: input.experience_level,
    status: "discovering",
    requirements: { goal: "", audience: "", constraints: input.constraints ?? [], questions: [] },
    messages: [{
      id: randomUUID(), role: "user", createdAt: timestamp,
      content: JSON.stringify({
        idea: input.idea,
        conversation_context: input.context,
        explicit_constraints: input.constraints ?? [],
        note: "An omitted or empty constraints list is not confirmation that there are no constraints. Only treat no constraints as confirmed if the user explicitly said so in the idea or context.",
      }),
    }],
    activities: [], tests: [], reviewApproved: false, createdAt: timestamp, updatedAt: timestamp,
  };
  // Keep the call inside the external tool's 60-second timeout. No invisible SDK retries.
  const result = await clarify(project, { timeout: 45000, maxRetries: 0 });
  return validatePlanningResult({
    status: result.plan ? "plan_ready" : "needs_clarification",
    ...result,
    approval_required: true,
  });
}

/** Validate both the JSON shape and the workflow invariants. */
export function validatePlanningResult(value: unknown) {
  const result = PlanProjectResponse.parse(value);
  if (result.approval_required !== true) throw new Error("A proposal cannot authorize a build");
  const { plan, requirements, status } = result;
  if (status === "plan_ready") {
    if (!plan || !requirements.goal.trim() || !requirements.audience.trim() || requirements.questions.length) {
      throw new Error("A ready plan requires resolved goal and audience and no open questions");
    }
    if (!plan.title.trim() || !plan.rationale.trim() || plan.steps.length < 2 || plan.steps.length > 8 || plan.steps.some(step => !step.trim())) {
      throw new Error("Invalid plan content");
    }
  } else if (plan !== null || requirements.questions.length !== 1 || !requirements.questions[0]?.trim()) {
    throw new Error("Clarification must contain one question and no plan");
  }
  if (!result.reply.trim() || !result.title.trim()) throw new Error("Empty planner reply");
  return result;
}
