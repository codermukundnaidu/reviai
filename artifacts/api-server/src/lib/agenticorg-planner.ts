const origin = "https://app.agenticorg.ai";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isAgenticOrgPlanningConfigured() {
  return Boolean(process.env.AGENTICORG_API_KEY &&
    uuid.test(process.env.AGENTICORG_PLANNER_ID ?? ""));
}

type Options = {
  timeout?: number;
  fetcher?: typeof fetch;
  key?: string;
  plannerId?: string;
};

/** Native AgenticOrg execution only. No Replit/OpenAI planner fallback. */
export async function requestAgenticOrgPlan(input: unknown, options: Options = {}) {
  const key = options.key ?? process.env.AGENTICORG_API_KEY;
  const id = options.plannerId ?? process.env.AGENTICORG_PLANNER_ID;
  if (!key || !id || !uuid.test(id)) {
    throw new Error("AgenticOrg planning is not configured: an authorized key and planner ID are required");
  }
  const fetcher = options.fetcher ?? fetch;
  const signal = AbortSignal.timeout(options.timeout ?? 45000);
  const headers = { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
  async function request(path: string, body?: unknown) {
    const response = await fetcher(`${origin}${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers, redirect: "error", signal,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (!response.ok) {
      // Never include response bodies or transport errors in user-facing errors.
      throw new Error(`AgenticOrg planner returned HTTP ${response.status}`);
    }
    const text = await response.text();
    if (text.length > 100000) throw new Error("AgenticOrg planner response exceeded its limit");
    return JSON.parse(text);
  }

  // Check server-owned configuration, not tool permissions supplied by the caller.
  const agent = await request(`/api/v1/agents/${id}`);
  const schema = agent.config?.output_schema_json;
  if (agent.id !== id || agent.agent_type !== "buildbuddy_product_planner" ||
      !["shadow", "active"].includes(agent.status) ||
      !Array.isArray(agent.authorized_tools) || agent.authorized_tools.length ||
      !Array.isArray(agent.connector_ids) || agent.connector_ids.length ||
      schema?.type !== "object" || schema.additionalProperties !== false ||
      !["reply", "title", "requirements", "plan"].every(field =>
        schema.required?.includes(field) && schema.properties?.[field])) {
    throw new Error("AgenticOrg planner must be the configured tool-free product planner with its output schema");
  }
  const result = await request(`/api/v1/agents/${id}/run`, {
    action: "plan_project", inputs: input, context: { approval_required: true },
  });
  if (result.agent_id !== id || result.status !== "completed" ||
      !result.run_id || !Array.isArray(result.tool_calls) || result.tool_calls.length ||
      !result.output || typeof result.output !== "object" || Array.isArray(result.output)) {
    throw new Error("AgenticOrg did not complete a tool-free planning run");
  }
  return result.output as unknown;
}
