import { z } from "zod";

const text = z.string().trim().min(1);
export const conversationSchema = z.object({
  reply: text.max(12000),
  title: text.max(100),
  requirements: z.object({
    goal: z.string().trim().max(3000),
    audience: z.string().trim().max(2000),
    constraints: z.array(text.max(1000)).max(12),
    questions: z.array(text.max(1000)).max(1),
  }).strict(),
  plan: z.object({
    title: text.max(160),
    kind: z.enum(["tracker", "checklist", "calculator", "information"]),
    rationale: text.max(3000),
    steps: z.array(text.max(1000)).min(2).max(8),
  }).strict().nullable(),
}).strict();

// Keep the task's JSON Schema aligned with Zod; this workspace uses Zod 3.
const objectContract = (properties: Record<string, unknown>) => ({
  type: "object", additionalProperties: false, required: Object.keys(properties), properties,
});
const stringContract = (maxLength: number, minLength = 1) => ({ type: "string", minLength, maxLength });
const listContract = (maxItems: number, minItems = 0) => ({
  type: "array", minItems, maxItems, items: stringContract(1000),
});
export const planningContract = objectContract({
  reply: stringContract(12000), title: stringContract(100),
  requirements: objectContract({
    goal: stringContract(3000, 0), audience: stringContract(2000, 0),
    constraints: listContract(12), questions: listContract(1),
  }),
  plan: { anyOf: [
    objectContract({
      title: stringContract(160),
      kind: { type: "string", enum: ["tracker", "checklist", "calculator", "information"] },
      rationale: stringContract(3000), steps: listContract(8, 2),
    }),
    { type: "null" },
  ] },
});

export function validateConversation(value: unknown) {
  const parsed = conversationSchema.parse(value);
  if (parsed.plan && (!parsed.requirements.goal || !parsed.requirements.audience || parsed.requirements.questions.length)) {
    throw new Error("A proposal requires resolved goal and audience and no open questions");
  }
  if (!parsed.plan && parsed.requirements.questions.length !== 1) {
    throw new Error("Clarification requires exactly one question and no plan");
  }
  return parsed;
}
