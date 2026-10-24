import { openai } from "@workspace/integrations-openai-ai-server";
import { z } from "zod";
import type { Project } from "./project-store";
import { requestAgenticOrgPlan } from "./agenticorg-planner";

const kind = z.enum(["tracker", "checklist", "calculator", "information"]);
const planSchema = z.object({
  title: z.string().min(1).max(160), kind,
  rationale: z.string().min(1).max(3000),
  steps: z.array(z.string().min(1).max(1000)).min(2).max(8),
}).strict();
const conversationSchema = z.object({
  reply: z.string().min(1).max(12000),
  title: z.string().min(1).max(100),
  requirements: z.object({
    goal: z.string().max(3000),
    audience: z.string().max(2000),
    constraints: z.array(z.string().max(1000)).max(12),
    questions: z.array(z.string().min(1).max(1000)).max(1),
  }).strict(),
  plan: planSchema.nullable(),
}).strict();
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

export async function clarify(project: Project, options: { timeout?: number; maxRetries?: number } = {}) {
  const output = await requestAgenticOrgPlan({
    experience_level: project.level,
    requirements: project.requirements,
    messages: project.messages.slice(-30).map(m => ({ role: m.role, content: m.content })),
    note: "Omitted constraints do not confirm no constraints. Ask one question if needed. Drafting a plan does not authorize building.",
  }, { timeout: options.timeout ?? 45000 });
  const parsed = conversationSchema.parse(output);
  if (parsed.plan && (!parsed.requirements.goal.trim() || !parsed.requirements.audience.trim() || parsed.requirements.questions.length)) {
    throw new Error("AgenticOrg proposed a plan with unresolved requirements");
  }
  if (!parsed.plan && parsed.requirements.questions.length !== 1) {
    throw new Error("AgenticOrg clarification must contain exactly one question");
  }
  return parsed;
}

export async function generatePrototype(project: Project) {
  if (!project.plan) throw new Error("No approved plan");
  if (process.env.AGENTICORG_URL && process.env.AGENTICORG_API_KEY) {
    const url = new URL(process.env.AGENTICORG_URL);
    if (url.protocol !== "https:") throw new Error("AgenticOrg endpoint must use HTTPS");
    const response = await fetch(url, {
      method: "POST", redirect: "error", signal: AbortSignal.timeout(60000),
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.AGENTICORG_API_KEY}` },
      body: JSON.stringify({ projectId: project.id, experienceLevel: project.level,
        requirements: project.requirements, approvedPlan: project.plan,
        outputContract: { prototype: { kind: project.plan.kind, title: "string", description: "string", items: ["string"] } } }),
    });
    if (!response.ok) throw new Error(`AgenticOrg returned HTTP ${response.status}`);
    const raw = await response.text();
    if (raw.length > 100000) throw new Error("AgenticOrg response exceeded safety limit");
    return prototypeSchema.parse(JSON.parse(raw).prototype);
  }
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
