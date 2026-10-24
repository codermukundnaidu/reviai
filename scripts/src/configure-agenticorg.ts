import { readFile } from "node:fs/promises";
import { isDeepStrictEqual } from "node:util";

// Operator-only provisioning. Never expose this operation through a browser route.
// The host and contracts are verified against AgenticOrg's official SDK/source.
const origin = "https://app.agenticorg.ai";
const template = JSON.parse(await readFile(
  new URL("../../docs/agenticorg-planner.template.json", import.meta.url), "utf8",
));
const key = process.env.AGENTICORG_API_KEY;
if (!key) throw new Error("Add AGENTICORG_API_KEY using Replit Secrets first.");

type Agent = {
  id: string; name: string; agent_type: string; status: string;
  authorized_tools?: string[]; connector_ids?: string[];
  system_prompt_text?: string; config?: { output_schema_json?: unknown };
};

async function request(path: string, method = "GET", body?: unknown) {
  const response = await fetch(`${origin}${path}`, {
    method, redirect: "error", signal: AbortSignal.timeout(60000),
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (!response.ok) {
    // Do not log the response body: upstream errors can include credential hints.
    throw new Error(`AgenticOrg ${method} ${path} returned HTTP ${response.status}. No authentication or provider payload was logged.`);
  }
  return response.json();
}

async function configure() {
  let existing: Agent | undefined;
  let page = 1;
  do {
    const result = await request(`/api/v1/agents?page=${page}&per_page=20`) as {
      items: Agent[]; pages: number;
    };
    if (!Array.isArray(result.items)) throw new Error("Unexpected agent discovery contract.");
    existing = result.items.find(agent =>
      agent.name === template.name && agent.agent_type === template.agent_type);
    if (existing || page >= result.pages) break;
    if (++page > 100) throw new Error("Agent discovery pagination exceeded safety limit.");
  } while (true);

  let agent: Agent;
  if (!existing) {
    agent = await request("/api/v1/agents", "POST", {
      name: template.name, agent_type: template.agent_type, domain: template.domain,
      system_prompt_text: template.system_prompt_text,
      initial_status: "shadow", authorized_tools: [], connector_ids: [],
      use_default_tools: false, max_retries: 0,
      cost_controls: {
        daily_token_budget: 100000, monthly_cost_cap_usd: 10,
        on_budget_exceeded: "pause_and_alert",
      },
    }) as Agent;
    console.log(JSON.stringify({ created: true, agentId: agent.id, name: agent.name, status: agent.status }));
  } else {
    agent = await request(`/api/v1/agents/${existing.id}`) as Agent;
    if (agent.system_prompt_text !== template.system_prompt_text) {
      throw new Error("The existing managed planner has a different prompt. Review it before updating; no existing agent was overwritten.");
    }
  }
  if (!agent.id || !/^[0-9a-f-]{36}$/i.test(agent.id) ||
      agent.agent_type !== template.agent_type ||
      agent.authorized_tools?.length !== 0 || agent.connector_ids?.length !== 0) {
    throw new Error("Planner identity or tool-free safety check failed.");
  }
  if (agent.status !== "shadow") {
    throw new Error("Planner is not in shadow mode. Do not change an active agent's prompt or output contract.");
  }
  await request(`/api/v1/agents/${agent.id}/output-schema`, "PUT", { schema: template.schema });
  const verified = await request(`/api/v1/agents/${agent.id}`) as Agent;
  if (verified.system_prompt_text !== template.system_prompt_text ||
      verified.authorized_tools?.length !== 0 || verified.connector_ids?.length !== 0 ||
      !isDeepStrictEqual(verified.config?.output_schema_json, template.schema)) {
    throw new Error("Planner configuration read-back did not match.");
  }
  console.log(JSON.stringify({
    configured: true, origin, agentId: verified.id, status: verified.status,
    toolFree: true, schemaSaved: true, activated: false,
    next: "Set AGENTICORG_PLANNER_ID through the environment configuration, then run the live planning checks.",
  }));
}

try {
  await configure();
} catch (error) {
  console.error(error instanceof Error && error.message.startsWith("AgenticOrg ")
    ? error.message
    : error instanceof Error && !/fetch|connect|socket|timeout/i.test(error.message)
      ? error.message
      : "AgenticOrg provisioning request failed; sensitive transport details were not logged.");
  process.exitCode = 1;
}
