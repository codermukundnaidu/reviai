import test from "node:test";
import assert from "node:assert/strict";
import { AgenticOrgPlanningError, requestAgenticOrgPlan } from "./agenticorg-planner";

const plannerId = "f73d995a-a6fe-44c0-9a41-cdc1026638cc";
const output = { reply: "Who will use it?", title: "Bakery tracker", requirements: {
  goal: "Track bakery orders", audience: "", constraints: [], questions: ["Who will use it?"],
}, plan: null };
const completed = {
  run_id: "real-provider-run", agent_id: plannerId, status: "completed", tool_calls: [], output,
};
function transport(responses: unknown[]) {
  const requests: { url: string; init: RequestInit | undefined }[] = [];
  const fetcher: typeof fetch = async (url, init) => {
    requests.push({ url: String(url), init });
    const value = responses.shift();
    if (value instanceof Response) return value;
    return Response.json(value);
  };
  return { fetcher, requests };
}

test("mandatory AgenticOrg configuration fails before any request, without a fallback", async () => {
  const client = transport([]);
  await assert.rejects(requestAgenticOrgPlan({}, { key: "", plannerId: "", fetcher: client.fetcher }), /not configured/);
  assert.equal(client.requests.length, 0);
});
test("run-only credential uses hackathon UUID endpoint and task input without a metadata preflight", async () => {
  const client = transport([completed]);
  const result = await requestAgenticOrgPlan({ idea: "Bakery" }, { key: "test-only-key", plannerId, fetcher: client.fetcher });
  assert.deepEqual(result, output);
  assert.equal(client.requests.length, 1);
  assert.equal(client.requests[0]?.url, `https://agenticorg.hackathon.pinelabs.com/api/v1/agents/${plannerId}/run`);
  assert.equal(client.requests[0]?.init?.method, "POST");
  assert.equal(client.requests[0]?.init?.redirect, "error");
  assert.equal((client.requests[0]?.init?.headers as Record<string, string>).Authorization, "Bearer test-only-key");
  const body = JSON.parse(String(client.requests[0]?.init?.body));
  assert.equal(body.action, "process");
  assert.equal(typeof body.inputs.task, "string");
  assert.ok(body.inputs.task.includes('"idea":"Bakery"'));
  assert.ok(body.inputs.task.includes("Expected JSON schema:"));
  assert.equal(body.context.approval_required, true);
});
test("AgenticOrg authorization failures do not log upstream payloads or trigger another provider", async () => {
  const client = transport([new Response("sensitive-provider-error", { status: 403 })]);
  await assert.rejects(requestAgenticOrgPlan({}, { key: "test-only-key", plannerId, fetcher: client.fetcher }), error =>
    error instanceof Error && error.message.includes("HTTP 403") && !error.message.includes("sensitive"));
  assert.equal(client.requests.length, 1);
});
test("unsupported origins and invalid UUIDs cannot receive the credential", async () => {
  for (const unsafe of [
    { baseUrl: "https://untrusted.example" },
    { baseUrl: "http://agenticorg.hackathon.pinelabs.com" },
    { baseUrl: "https://agenticorg.hackathon.pinelabs.com/other" },
    { baseUrl: "https://agenticorg.hackathon.pinelabs.com?forward=1" },
    { plannerId: "product_agent" },
  ]) {
    const client = transport([]);
    await assert.rejects(requestAgenticOrgPlan({}, { key: "test-only-key", plannerId, fetcher: client.fetcher, ...unsafe }), /not configured/);
    assert.equal(client.requests.length, 0);
  }
});
test("failed, gated, wrong-agent, or tool-executing runs cannot become accepted plans", async () => {
  for (const invalid of [
    { ...completed, status: "failed" },
    { ...completed, status: "hitl_triggered" },
    { ...completed, status: "budget_exceeded" },
    { ...completed, agent_id: "other-agent" },
    { ...completed, tool_calls: [{ tool: "send_email" }] },
    { ...completed, output: "not a structured object" },
    { ...completed, run_id: "" },
    { ...completed, tool_calls: undefined },
    { ...completed, output: { raw_output: JSON.stringify(output), status: "completed" } },
    { ...completed, output: { ...output, extra: true } },
    { ...completed, output: { ...output, requirements: { ...output.requirements, questions: [] } } },
    { ...completed, output: { ...output, reply: "  " } },
  ]) {
    const client = transport([invalid]);
    await assert.rejects(requestAgenticOrgPlan({}, { key: "test-only-key", plannerId, fetcher: client.fetcher }), error => error instanceof AgenticOrgPlanningError);
    assert.equal(client.requests.length, 1);
  }
});

test("human review reports the existing run and never approves, polls, or starts another run", async () => {
  const client = transport([{ ...completed, status: "hitl_triggered" }]);
  await assert.rejects(requestAgenticOrgPlan({}, { key: "test-only-key", plannerId, fetcher: client.fetcher }), error =>
    error instanceof AgenticOrgPlanningError && error.code === "review_required" &&
    error.message.includes(completed.run_id) && error.message.includes("/dashboard/approvals"));
  assert.equal(client.requests.length, 1);
});

test("completed proposals require resolved requirements and useful steps", async () => {
  const ready = { ...output, requirements: { ...output.requirements, audience: "Staff", questions: [] },
    plan: { title: "Bakery", kind: "tracker", rationale: "A simple prototype.", steps: ["Generate example labels", "Validate and review the preview"] } };
  const call = (value: unknown) => requestAgenticOrgPlan({}, {
    key: "test-only-key", plannerId, fetcher: transport([{ ...completed, output: value }]).fetcher,
  });
  assert.deepEqual(await call(ready), ready);
  await assert.rejects(call({ ...ready, requirements: { ...ready.requirements, audience: "" } }), /valid Revi plan/);
  await assert.rejects(call({ ...ready, plan: { ...ready.plan, steps: [" ", "Review"] } }), /valid Revi plan/);
});

test("provider failures are classified without exposing private error text", async () => {
  for (const error of ["GoogleRateLimitError: private payload", "GoogleModelNotFoundError: private payload"]) {
    const client = transport([{ ...completed, status: "failed", error }]);
    await assert.rejects(requestAgenticOrgPlan({}, { key: "test-only-key", plannerId, fetcher: client.fetcher }), e =>
      e instanceof AgenticOrgPlanningError && e.code === "execution_failed" && !e.message.includes("private payload"));
  }
  const fetcher: typeof fetch = async () => { throw new Error("private network payload"); };
  await assert.rejects(requestAgenticOrgPlan({}, { key: "test-only-key", plannerId, fetcher }), e =>
    e instanceof AgenticOrgPlanningError && e.code === "transport" && !e.message.includes("private network payload"));
});
