# Revi → BuildBuddy planning webhook

## Implemented backend

`POST /api/plan-project` is a server-to-server JSON endpoint. It uses the same OpenAI planner as BuildBuddy's text conversations through Replit AI Integrations, with strict JSON Schema output and independent server-side shape/workflow validation. AgenticOrg is not used or required.

It does **not** save a project, start generation, approve a proposal, or deploy anything. The structured response goes back to the ElevenLabs tool caller. The current voice widget can discuss that response; it does not automatically import it into the saved project workspace.

### Exact body contract

The source of truth is `PlanningInput` in `lib/api-spec/openapi.yaml`. Generated server validators and frontend client types use this same contract.

```json
{
  "idea": "I need a personal daily checklist to stop forgetting routine tasks.",
  "experience_level": "Beginner",
  "context": "Only I will use it. Currently I use paper notes. I want to add tasks and mark them done. No sharing, accounts, or reminders. I explicitly have no other constraints.",
  "constraints": ["No external integrations"]
}
```

| Field | Required | Type and limits |
|---|---|---|
| `idea` | Yes | Nonblank string, 1–10,000 characters |
| `experience_level` | Yes | Exactly `Beginner`, `Intermediate`, `Advanced`, or `Pro` |
| `context` | Yes | String, up to 20,000 characters; may be empty, but missing requirements will lead to clarification |
| `constraints` | No | Up to 12 nonblank strings, each 1–1,000 characters |

Unknown body fields are rejected. Include audience, workflow, clarification answers, and other constraints in `context`. Never include credentials. An omitted/empty constraints list is not permission to invent constraints or assume none.

### Responses

Successful requests return HTTP 200 with:

```json
{
  "status": "plan_ready",
  "reply": "A personal checklist is enough for this goal. Please approve the proposal before building.",
  "title": "Daily checklist",
  "requirements": {
    "goal": "Remember routine tasks",
    "audience": "Just the user",
    "constraints": ["No external integrations"],
    "questions": []
  },
  "plan": {
    "title": "Daily checklist",
    "kind": "checklist",
    "rationale": "A simple checklist supports adding and completing tasks without a complex application.",
    "steps": ["Show a list of tasks", "Allow adding tasks and marking them complete"]
  },
  "approval_required": true
}
```

This example illustrates the contract, not a stored or pre-generated result. Plan kinds match BuildBuddy's safe prototype capabilities: `tracker`, `checklist`, `calculator`, `information`. Plans contain 2–8 steps.

If something material is missing, `status` is `needs_clarification`, `plan` is `null`, and `requirements.questions` contains exactly one question. The agent should collect that answer before trying again.

Errors: 400 invalid input/JSON, 401 invalid bearer credentials, 413 oversized request, 415 non-JSON content type, 429 planning budget/concurrency exceeded, 502 failed or invalid model response, 503 unconfigured AI or webhook authentication. Error responses never claim a plan succeeded.

## Secure configuration and publishing

1. Store a high-entropy shared secret of at least 32 characters as `PLANNING_WEBHOOK_SECRET` in Replit Secrets. Make sure it is available to the published API service. Do not put it in a `VITE_*` variable, source file, widget, browser request, conversation, or tool parameter.
2. Publish the app with a publicly reachable backend, following the README's Reserved VM instructions. Obtain the actual published URL from publishing metadata. Do not use the development preview URL as the production webhook.
3. In ElevenLabs secure tool authentication, create a secret whose value is the complete header value `Bearer ` followed by the same shared secret. Configure the `Authorization` header to reference that secret. It must not be an LLM-generated body field.
4. Use the verified published origin plus `/api/plan-project` as the tool URL. No browser session/cookie is required. An authenticated tool call is sufficient.
5. Test from ElevenLabs after publishing. A missing secret intentionally returns 503, not an insecure development fallback.

The endpoint allows three concurrent model calls and 20 new requests per minute per API process. Identical valid requests share an in-flight/cached result for two minutes to avoid duplicate paid calls. A materially changed context produces a new request. These are bounded process-local protections, not a durable multi-instance quota service.

## ElevenLabs tool setup

The live tool is installed on Revi as `tool_1201m5phma7nfvqtfzjgfxrg3bfa`, with a secure ElevenLabs secret reference and the managed planning instructions appended to the existing prompt. Tool membership, POST URL, parameter names, required fields, experience-level enum, secure header reference, and call-timing instructions were verified by reading back the provider configuration.

`docs/elevenlabs-planning-tool.template.json` remains a reusable template, not a copy containing credentials. Live OpenAI tests passed for both complete requirements (validated proposal) and incomplete requirements (exactly one question). At the latest published check this route returned 404; republish the updated backend before live voice use. A live voice conversation has not yet been tested, and voice results are not automatically saved into browser-owned projects.

- Name: `understand_and_plan_project`
- Method: `POST`
- URL: verified published backend origin + `/api/plan-project`
- Content type: `application/json`
- Required inputs: `idea`, `experience_level`, `context`
- Optional input: `constraints`
- Authorization header: ElevenLabs secret reference, not literal credentials
- Response timeout: 60 seconds (backend model request uses a 45-second timeout without retries)

The verified published origin is `https://reviai.replit.app`; the template uses `https://reviai.replit.app/api/plan-project`. The live deployment checked during implementation still served the earlier code and returned 404 for this route, so the latest code must be republished after secure configuration. Replace the secret reference with the ElevenLabs-created secret ID, never with a raw secret. If the deployment domain changes, update the URL using verified publishing metadata. ElevenLabs' parameter schema supports names/types/enums; its descriptions carry the length limits that the backend enforces.

Create the tool in the ElevenLabs workspace, then attach its ID to Revi's existing agent `agent_5401m5pfy3nxezer03ar2rp5926v`. Preserve all existing tool IDs and the agent's current settings. Append `docs/revi-planning-prompt.md` to the existing system prompt rather than replacing it.

The deployment URL, service authentication, and ElevenLabs account access are prerequisites for registration. They are now configured for this workspace, but production must run the latest backend code and have the shared webhook secret available before the installed tool can succeed.

### Server-side setup command

The setup script reads `PLANNING_WEBHOOK_SECRET` only in the server-side process and transfers the complete bearer-header value to ElevenLabs' secure secret store through the managed connector. It never prints or writes the credential. It preserves existing tool IDs and the original agent prompt, appending/replacing only its own marked instructions block.

```sh
pnpm --filter @workspace/scripts run configure:revi --origin https://reviai.replit.app
```

Only pass a production origin verified through publishing metadata. The command reuses an existing matching secret reference and updates the named tool, so rerunning does not add duplicate tools or prompt blocks. If rotating `PLANNING_WEBHOOK_SECRET`, update the corresponding ElevenLabs secure secret too; rerunning alone does not replace an existing secret's value.

## Call timing and verification

Revi should understand goal, audience, workflow, constraints, and experience level before the first planning call. Do not call on each user sentence or acknowledgement. Call again only after a requested clarification has been answered or a material requirement has changed and is understood.

Try these agent scenarios once connected:

1. “I have an idea.” → one conversational follow-up, no tool call.
2. Several partial sentences → continue listening/clarifying, no per-sentence calls.
3. A complete goal, audience, workflow, constraints, and level → one planning call.
4. A tool clarification → ask the returned question; don't immediately retry.
5. An unchanged acknowledgement or approval → no new planning call and no build.
6. Material requirement revision → clarify if needed, then make one new call.
7. Authentication/model failure → honest failure explanation, no retry loop or fabricated plan.

Backend checks:

```sh
pnpm --filter @workspace/api-server run test:planning
pnpm run typecheck
```

The test suite includes synthetic authentication/validation/rate-limit tests and two real configured-model checks when AI credentials exist. It does not prove that the unconnected ElevenLabs tool is installed or that a live voice conversation follows the prompt.
