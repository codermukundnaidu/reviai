import test from "node:test";
import assert from "node:assert/strict";
import { requestAgenticOrgPlan } from "./agenticorg-planner";

const plannerId = "f73d995a-a6fe-44c0-9a41-cdc1026638cc";
const output = { reply: "Who will use it?", title: "Bakery tracker", requirements: {
  goal: "Track bakery orders", audience: "", constraints: [], questions: ["Who will use it?"],
}, plan: null };
const metadata = {
  id: plannerId, agent_type: "buildbuddy_product_planner", status: "shadow",
  authorized_tools: [], connector_ids: [],
  config: { output_schema_json: {
    type: "object", additionalProperties: false,
    required: ["reply", "title", "requirements", "plan"],
    properties: { reply: {}, title: {}, requirements: {}, plan: {} },
  } },
};
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
test("native AgenticOrg metadata and run use only the verified host and server authorization", async () => {
  const client = transport([metadata, completed]);
  const result = await requestAgenticOrgPlan({ idea: "Bakery" }, { key: "test-only-key", plannerId, fetcher: client.fetcher });
  assert.deepEqual(result, output);
  assert.equal(client.requests.length, 2);
  assert.equal(client.requests[1]?.url, `https://app.agenticorg.ai/api/v1/agents/${plannerId}/run`);
  assert.equal(client.requests[1]?.init?.method, "POST");
  assert.equal(client.requests[1]?.init?.redirect, "error");
  const body = JSON.parse(String(client.requests[1]?.init?.body));
  assert.equal(body.action, "plan_project");
  assert.equal(body.context.approval_required, true);
});
test("AgenticOrg authorization failures do not log upstream payloads or trigger another provider", async () => {
  const client = transport([new Response("sensitive-provider-error", { status: 403 })]);
  await assert.rejects(requestAgenticOrgPlan({}, { key: "test-only-key", plannerId, fetcher: client.fetcher }), error =>
    error instanceof Error && error.message.includes("HTTP 403") && !error.message.includes("sensitive"));
  assert.equal(client.requests.length, 1);
});
test("planner with external tools, missing schema, or inactive lifecycle is refused before running", async () => {
  for (const unsafe of [
    { ...metadata, authorized_tools: ["send_email"] },
    { ...metadata, connector_ids: ["mail"] },
    { ...metadata, config: {} },
    { ...metadata, status: "retired" },
    { ...metadata, agent_type: "confluence:create_page" },
  ]) {
    const client = transport([unsafe]);
    await assert.rejects(requestAgenticOrgPlan({}, { key: "test-only-key", plannerId, fetcher: client.fetcher }), /tool-free/);
    assert.equal(client.requests.length, 1);
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
  ]) {
    const client = transport([metadata, invalid]);
    await assert.rejects(requestAgenticOrgPlan({}, { key: "test-only-key", plannerId, fetcher: client.fetcher }), /did not complete/);
  }
});
