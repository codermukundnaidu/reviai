# Mandatory AgenticOrg product planner

AgenticOrg is mandatory for Revi's product planning. Both text conversations and
`POST /api/plan-project` use the native AgenticOrg agent-run API. They do not fall
back to OpenAI. Missing configuration returns HTTP 503 before planning or
invalidating an existing project plan.

## Current blocker

Agent discovery worked, but creating the dedicated planner returned HTTP 403.
A subsequent non-mutating permission probe (an invalid create body) returned HTTP
401. No dedicated planner was created or activated, and no successful native
planning run has been claimed. An AgenticOrg administrator must authorize a
valid key for discovery, creation/configuration, and execution, or create the
planner manually and provide an execution-authorized key.

Never use `https://api.grantex.dev` as the planning URL: it is the authorization
service, not the AgenticOrg runtime. Never send the AgenticOrg key there.

## Provisioning

The verified native host, from AgenticOrg's official SDK, is
`https://app.agenticorg.ai`. Server-side configuration:

- `AGENTICORG_API_KEY`: sensitive credential, entered only through Secrets.
- `AGENTICORG_PLANNER_ID`: non-secret UUID of the dedicated product planner.
- `PLANNING_WEBHOOK_SECRET`: existing server-to-server ElevenLabs authorization.

With an authorized key, run:

```sh
pnpm --filter @workspace/scripts run configure:agenticorg
```

The operator-only script creates **Revi Product Planner**, type
`buildbuddy_product_planner`, domain `ops`, in **shadow** mode with no authorized
tools, no connectors, and default-tool assignment disabled. It uses the prompt
and JSON Schema in `docs/agenticorg-planner.template.json`, then verifies the
saved configuration. It never overwrites a different existing prompt, promotes
an agent, changes global permissions, or modifies DevMate.

The administrator can instead use that same template through AgenticOrg's UI.
Set its schema through the supported agent output-schema control. AgenticOrg
stores it as `config.output_schema_json`. The platform only enforces it on runs
when `AGENTICORG_OUTPUT_SCHEMA_ENFORCED` is enabled; have the administrator
confirm that policy. Revi independently validates all returned data and workflow
invariants regardless of that provider setting.

Set `AGENTICORG_PLANNER_ID` through environment configuration after read-back
succeeds, restart the API, then run:

```sh
pnpm --filter @workspace/api-server run test:planning
```

Two live planner checks run only when both the key and planner ID are configured.
They must confirm one question for incomplete requirements and a proposal for a
complete idea. Local transport tests are not evidence of a working external run.

## Native execution

The backend checks the agent's metadata, tool-free configuration, lifecycle,
and declared output schema before calling:

```http
POST https://app.agenticorg.ai/api/v1/agents/{AGENTICORG_PLANNER_ID}/run
Authorization: Bearer <server-only credential>
Content-Type: application/json
```

```json
{
  "action": "plan_project",
  "inputs": {
    "experience_level": "Beginner",
    "requirements": { "goal": "", "audience": "", "constraints": [], "questions": [] },
    "messages": [{ "role": "user", "content": "The user's idea and conversation context" }]
  },
  "context": { "approval_required": true }
}
```

Only a canonical completed run for the expected agent with a run ID, zero tool
calls, and a structured output object is accepted. Its output must contain
`reply`, `title`, `requirements`, and nullable `plan`, matching the template.
Revi rejects failed, human-gated, budget-exceeded, malformed, or tool-executing
runs. Proposals never authorize generation.

## Builder boundary

This integration prepares product plans, not executable projects. The existing
four data-only prototype renderers and their legacy generator are not a real
bakery application builder. The next implementation must add the controlled
bakery workflow, real persistent orders, preview URL, and measured test events.
Do not claim that AgenticOrg planning or this builder is live until verified.

The old optional `AGENTICORG_URL` adapter in prototype generation is a separate
legacy custom contract, not this native planner. It must not be pointed at the
native host or Grantex, or presented as a coding-agent integration.
