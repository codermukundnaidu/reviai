import { test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import express from "express";
import pinoHttp from "pino-http";
import { createPlanningRouter } from "../routes/plan-project";
import { planFromIdea, validatePlanningResult } from "./plan-project";

// Synthetic test credential only. Never used as an application secret.
const testSecret = "synthetic-planning-test-credential-not-for-production";
const input = {
  idea: "I want a personal daily checklist to remember three tasks: check email, wash dishes, and water plants. I currently write these on scraps of paper and forget them. I only need to add tasks and mark them done.",
  experience_level: "Beginner" as const,
  context: "Audience: only me. Success: see today's tasks and check them off. No dates, recurring schedules, reminders, accounts, sharing, or integrations needed. A simple illustrative checklist prototype is enough, not a live synchronized service. The user explicitly confirms no budget, deadline, or other constraints beyond no external integrations.",
  constraints: ["No external integrations"],
};
const ready = {
  status: "plan_ready", title: "Daily checklist", reply: "Here is a proposed checklist. Approval is required.",
  requirements: { goal: "Remember daily tasks", audience: "Just me", constraints: ["No external integrations"], questions: [] },
  plan: { title: "Daily checklist", kind: "checklist", rationale: "A checklist is sufficient.", steps: ["Show tasks", "Allow checking tasks off"] },
  approval_required: true,
};
const clarification = {
  status: "needs_clarification", title: "Your idea", reply: "Who is this for?",
  requirements: { goal: "Remember tasks", audience: "", constraints: [], questions: ["Who is this for?"] },
  plan: null, approval_required: true,
};

async function harness(options: Parameters<typeof createPlanningRouter>[0] = {}) {
  const app = express();
  app.use(pinoHttp({ enabled: false }));
  app.use(express.json({ limit: "64kb" }));
  app.use("/api", createPlanningRouter({
    getSecret: () => testSecret, isConfigured: () => true,
    planner: async () => ready, ...options,
  }));
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return {
    post: (body: unknown = input, token: string | null = testSecret, contentType = "application/json") =>
      fetch(`${base}/api/plan-project`, {
        method: "POST",
        headers: { "Content-Type": contentType, ...(token === null ? {} : { Authorization: `Bearer ${token}` }) },
        body: JSON.stringify(body),
      }),
    close: () => new Promise<void>((resolve, reject) => {
      server.close(error => error ? reject(error) : resolve());
      server.closeAllConnections();
    }),
  };
}

test("webhook authentication fails closed without any browser session", async () => {
  let calls = 0;
  const h = await harness({ planner: async () => { calls++; return ready; } });
  try {
    assert.equal((await h.post(input, null)).status, 401);
    assert.equal((await h.post(input, "wrong")).status, 401);
    assert.equal(calls, 0);
    const result = await h.post();
    assert.equal(result.status, 200);
    assert.equal(result.headers.get("set-cookie"), null);
    assert.equal(result.headers.get("cache-control"), "no-store");
    assert.deepEqual(await result.json(), ready);
  } finally { await h.close(); }
});

test("missing or short configured authentication returns 503, not a bypass", async () => {
  for (const secret of [undefined, "too-short"]) {
    const h = await harness({ getSecret: () => secret });
    try { assert.equal((await h.post()).status, 503); } finally { await h.close(); }
  }
});

test("exact request contract validates lengths, levels, whitespace, JSON type, and unknown fields", async () => {
  const h = await harness();
  try {
    const invalid = [
      { ...input, idea: " " }, { ...input, idea: "x".repeat(10001) },
      { ...input, experience_level: "expert" }, { idea: input.idea, experience_level: "Beginner" },
      { ...input, goal: "unexpected" }, { ...input, constraints: [" "] },
      { ...input, context: "x".repeat(20001) },
      { ...input, constraints: Array(13).fill("x") },
    ];
    for (const body of invalid) assert.equal((await h.post(body)).status, 400);
    assert.equal((await h.post(input, testSecret, "text/plain")).status, 415);
    const { constraints: _constraints, ...requiredOnly } = input;
    assert.equal((await h.post(requiredOnly)).status, 200);
  } finally { await h.close(); }
});

test("clarification returns exactly one unresolved question and a null plan", async () => {
  const h = await harness({ planner: async () => clarification });
  try {
    const response = await h.post();
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), clarification);
  } finally { await h.close(); }
});

test("invalid or failed provider responses become explicit 502 errors without leaking details", async () => {
  const h = await harness({ planner: async () => { throw new Error("private provider details"); } });
  try {
    const response = await h.post();
    assert.equal(response.status, 502);
    assert.ok(!JSON.stringify(await response.json()).includes("private provider details"));
  } finally { await h.close(); }
  const invalid = await harness({ planner: async () => ({ ...ready, plan: null }) });
  try { assert.equal((await invalid.post()).status, 502); } finally { await invalid.close(); }
});

test("workflow validation rejects premature plans, multiple questions, and implied approval", () => {
  const invalid = [
    { ...ready, approval_required: false },
    { ...ready, requirements: { ...ready.requirements, audience: "" } },
    { ...ready, requirements: { ...ready.requirements, questions: ["Unknown constraint?"] } },
    { ...clarification, plan: ready.plan },
    { ...clarification, requirements: { ...clarification.requirements, questions: [] } },
    { ...clarification, requirements: { ...clarification.requirements, questions: ["One?", "Two?"] } },
    { ...ready, plan: { ...ready.plan, steps: [""] } },
  ];
  for (const result of invalid) assert.throws(() => validatePlanningResult(result));
});

test("identical requests deduplicate without silently repeating paid model calls", async () => {
  let calls = 0;
  const h = await harness({ planner: async () => {
    calls++;
    await new Promise(resolve => setTimeout(resolve, 20));
    return ready;
  } });
  try {
    const responses = await Promise.all([h.post(), h.post(), h.post()]);
    for (const response of responses) assert.equal(response.status, 200);
    assert.equal(calls, 1);
    assert.equal((await h.post()).status, 200);
    assert.equal(calls, 1);
  } finally { await h.close(); }
});

test("authenticated traffic is bounded by a per-process planning budget", async () => {
  const h = await harness();
  try {
    for (let i = 0; i < 20; i++) assert.equal((await h.post({ ...input, idea: `Unique idea ${i}` })).status, 200);
    const response = await h.post({ ...input, idea: "One too many" });
    assert.equal(response.status, 429);
    assert.equal(response.headers.get("retry-after"), "60");
  } finally { await h.close(); }
});

test("configured real planner honors a complete idea and returns a validated proposal", {
  skip: !(process.env.AGENTICORG_API_KEY && process.env.AGENTICORG_PLANNER_ID),
  timeout: 55000,
}, async () => {
  const result = await planFromIdea(input);
  assert.equal(result.status, "plan_ready", JSON.stringify(result));
  assert.equal(result.approval_required, true);
  assert.ok(result.plan);
});

test("configured real planner asks one question for an incomplete idea", {
  skip: !(process.env.AGENTICORG_API_KEY && process.env.AGENTICORG_PLANNER_ID),
  timeout: 55000,
}, async () => {
  const result = await planFromIdea({ idea: "I need help organizing things.", experience_level: "Beginner", context: "" });
  assert.equal(result.status, "needs_clarification");
  assert.equal(result.plan, null);
  assert.equal(result.requirements.questions.length, 1);
});
