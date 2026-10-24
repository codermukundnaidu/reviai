import { openai } from "@workspace/integrations-openai-ai-server";
import { z } from "zod";
import type { Project } from "./project-store";
import { isAgenticOrgPlanningConfigured, requestAgenticOrgPlan } from "./agenticorg-planner";

const kind = z.enum(["tracker", "checklist", "calculator", "information"]);
export const prototypeSchema = z.object({
  kind,
  title: z.string().min(1).max(160),
  description: z.string().min(1).max(3000),
  items: z.array(z.string().min(1).max(1000)).min(1).max(20),
}).strict();

const textContract = { type: "string" };
const listContract = { type: "array", items: textContract };
const kindContract = { type: "string", enum: ["tracker", "checklist", "calculator", "information"] };
const objectContract = (properties: Record<string, unknown>) => ({
  type: "object", additionalProperties: false, required: Object.keys(properties), properties,
});
const prototypeContract = objectContract({
  kind: kindContract, title: textContract, description: textContract, items: listContract,
});
export function isPlanningConfigured() {
  return isAgenticOrgPlanningConfigured();
}

export async function clarify(project: Project, options: { timeout?: number; maxRetries?: number } = {}) {
  return requestAgenticOrgPlan({
    experience_level: project.level,
    requirements: project.requirements,
    messages: project.messages.slice(-30).map(m => ({ role: m.role, content: m.content })),
  }, { timeout: options.timeout ?? 120000 });
}

export async function generatePrototype(project: Project) {
  if (!project.plan) throw new Error("No approved plan");
  const response = await openai.chat.completions.create({
    model: "gpt-5.4-mini", max_completion_tokens: 8192,
    response_format: { type: "json_schema", json_schema: { name: "prototype", strict: true, schema: prototypeContract } },
    messages: [
      { role: "system", content: `Generate DATA ONLY for a safe prebuilt interactive prototype.
Return JSON {"kind":"${project.plan.kind}","title":"short title","description":"brief useful description with prototype limitations","items":["3-8 realistic useful initial item labels or information sections"]}.
Do not output HTML, scripts, code, secrets or claim any external action happened.
Kind must match the approved plan. Calculator supports sum and average of labeled numeric inputs only, do not claim other formulas.
Information items must use "Heading: useful paragraph text". Trackers/checklists contain actionable short labels. Calculator items are distinct numeric input labels, not sample values.
Respect user's actual requirements; initial content is illustrative prototype content, not live business data.` },
      { role: "user", content: JSON.stringify({ requirements: project.requirements, plan: project.plan }) },
    ],
  }, { timeout: 60000, maxRetries: 2 });
  const raw = response.choices[0]?.message.content;
  if (!raw) throw new Error("Generator returned no data");
  return prototypeSchema.parse(JSON.parse(raw));
}
