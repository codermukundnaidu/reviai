import { readFile } from "node:fs/promises";
import { ReplitConnectors } from "@replit/connectors-sdk";

// Run only from the server-side workspace. Credentials are never printed or written to files.
const AGENT_ID = "agent_5401m5pfy3nxezer03ar2rp5926v";
const TOOL_NAME = "understand_and_plan_project";
const SECRET_NAME = "BuildBuddy planning webhook authorization";
const BEGIN = "[BEGIN BUILDBUDDY PLANNING]";
const END = "[END BUILDBUDDY PLANNING]";

type Agent = {
  agent_id: string;
  name: string;
  conversation_config: { agent: { prompt: { prompt?: string; tool_ids?: string[] } } };
};
type Tool = { id: string; tool_config: { name: string; api_schema?: { url?: string } } };
type SecretRef = { secret_id: string; name: string };

async function configure() {
  const originArg = process.argv.indexOf("--origin");
  const rawOrigin = originArg >= 0 ? process.argv[originArg + 1] : undefined;
  if (!rawOrigin) throw new Error("Pass --origin with the verified production origin from publishing metadata.");
  const origin = new URL(rawOrigin);
  if (origin.protocol !== "https:" || origin.username || origin.password || origin.search || origin.hash || origin.pathname !== "/") {
    throw new Error("A plain HTTPS production origin is required.");
  }
  const secret = process.env.PLANNING_WEBHOOK_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("Configure PLANNING_WEBHOOK_SECRET securely with at least 32 characters before running setup.");
  }

  const connectors = new ReplitConnectors();
  async function api<T>(path: string, method = "GET", body?: unknown): Promise<T> {
    let response: Response;
    try {
      response = await connectors.proxy("elevenlabs", path, { method, ...(body === undefined ? {} : { body }) });
    } catch {
      throw new Error(`ElevenLabs connection failed during ${method} ${path}. No credentials were logged.`);
    }
    // Provider error bodies can echo request data. Never log or propagate those bodies.
    if (!response.ok) throw new Error(`ElevenLabs returned HTTP ${response.status} during ${method} ${path}.`);
    return await response.json() as T;
  }

  const original = await api<Agent>(`/v1/convai/agents/${AGENT_ID}`);
  if (original.agent_id !== AGENT_ID) throw new Error("Unexpected ElevenLabs agent.");
  const promptConfig = original.conversation_config.agent.prompt;
  const originalPrompt = promptConfig.prompt ?? "";
  const originalTools = promptConfig.tool_ids ?? [];
  const template = JSON.parse(await readFile(new URL("../../docs/elevenlabs-planning-tool.template.json", import.meta.url), "utf8"));
  const promptDoc = await readFile(new URL("../../docs/revi-planning-prompt.md", import.meta.url), "utf8");
  const instructions = promptDoc.match(/```text\n([\s\S]*?)\n```/)?.[1];
  if (!instructions) throw new Error("Revi planning instructions are missing.");
  if (template.tool_config?.name !== TOOL_NAME) throw new Error("Unexpected planning tool template.");

  const secretRefs: SecretRef[] = [];
  let cursor: string | null = null;
  do {
    const page: { secrets: SecretRef[]; next_cursor?: string | null } = await api(
      `/v1/convai/secrets${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`,
    );
    secretRefs.push(...page.secrets);
    cursor = page.next_cursor ?? null;
  } while (cursor);
  const secretMatches = secretRefs.filter(entry => entry.name === SECRET_NAME);
  if (secretMatches.length > 1) throw new Error("Multiple matching ElevenLabs secrets; resolve the duplicate before updating.");
  const secretRef = secretMatches[0] ?? await api<SecretRef>("/v1/convai/secrets", "POST", {
    type: "new", name: SECRET_NAME, value: `Bearer ${secret}`,
  });
  if (!secretRef.secret_id) throw new Error("ElevenLabs did not return a secure secret reference.");

  template.tool_config.api_schema.url = new URL("/api/plan-project", origin).href;
  template.tool_config.api_schema.request_headers.Authorization = { secret_id: secretRef.secret_id };
  const tools: Tool[] = [];
  cursor = null;
  do {
    const page: { tools: Tool[]; next_cursor?: string | null } = await api(
      `/v1/convai/tools${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`,
    );
    tools.push(...page.tools);
    cursor = page.next_cursor ?? null;
  } while (cursor);
  const matches = tools.filter(tool => tool.tool_config.name === TOOL_NAME);
  if (matches.length > 1) throw new Error("Multiple matching planning tools; resolve the duplicate before updating.");
  const existing = matches[0];
  const tool = await api<Tool>(existing ? `/v1/convai/tools/${existing.id}` : "/v1/convai/tools", existing ? "PATCH" : "POST", template);
  if (!tool.id) throw new Error("ElevenLabs did not return a tool ID.");

  // Only replace our own marked block; retain Revi's personality and any unrelated instructions.
  const begin = originalPrompt.indexOf(BEGIN);
  const end = originalPrompt.indexOf(END);
  if ((begin >= 0) !== (end >= 0) || (begin >= 0 && end < begin)) {
    throw new Error("Existing managed planning prompt block is incomplete; no agent prompt was overwritten.");
  }
  const basePrompt = begin >= 0
    ? originalPrompt.slice(0, begin) + originalPrompt.slice(end + END.length)
    : originalPrompt;
  const newPrompt = `${basePrompt.trimEnd()}\n\n${BEGIN}\n${instructions}\n${END}`;
  const toolIds = [...new Set([...originalTools, tool.id])];
  await api<Agent>(`/v1/convai/agents/${AGENT_ID}`, "PATCH", {
    conversation_config: { agent: { prompt: { prompt: newPrompt, tool_ids: toolIds } } },
  });
  const verified = await api<Agent>(`/v1/convai/agents/${AGENT_ID}`);
  const verifiedPrompt = verified.conversation_config.agent.prompt;
  if (verified.name !== original.name || verifiedPrompt.prompt !== newPrompt ||
      !toolIds.every(id => verifiedPrompt.tool_ids?.includes(id))) {
    throw new Error("Agent configuration read-back did not match the intended update.");
  }
  const verifiedTool = await api<Tool>(`/v1/convai/tools/${tool.id}`);
  if (verifiedTool.tool_config.name !== TOOL_NAME || verifiedTool.tool_config.api_schema?.url !== template.tool_config.api_schema.url) {
    throw new Error("Tool configuration read-back did not match the intended update.");
  }
  console.log(JSON.stringify({
    configured: true, agentId: AGENT_ID, toolId: tool.id,
    url: template.tool_config.api_schema.url,
    previousToolsPreserved: originalTools.length,
    secureAuthenticationReference: true,
    planningInstructionsVerified: true,
    note: "Republish the backend with its webhook secret before making live voice calls.",
  }));
}

configure().catch(error => {
  // Only our controlled messages are printed. Never serialize the SDK exception or request body.
  const message = error instanceof Error ? error.message : "Unknown error";
  const safe = /^(Pass --origin|A plain HTTPS|Configure PLANNING|ElevenLabs|Unexpected|Revi planning|Multiple matching|Existing managed|Agent configuration|Tool configuration)/.test(message);
  console.error(safe ? message : "Revi setup failed. No credentials were logged. Check the connected account and configuration.");
  process.exitCode = 1;
});
