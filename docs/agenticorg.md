# AgenticOrg planning connection

Revi's text chat and authenticated planning webhook call the dedicated planner
using the saved server-only credential:

- Base URL: `https://agenticorg.hackathon.pinelabs.com`
- Planner UUID: `4df6fad9-59cc-4b6b-bd26-56a08fef55bf`
- `POST /api/v1/agents/{UUID}/run`
- Body: `{ "action": "process", "inputs": { "task": "..." }, "context": { "approval_required": true } }`

The task includes experience level, existing requirements, recent conversation,
planning-only instructions, and Revi's complete expected JSON Schema. The agent
must be configured by its administrator as a tool-free product planner. Do not
reuse a business agent with tools or lower its review threshold to pass a test.

Only a `completed` run for the configured UUID, with a run ID, zero tool calls,
and a strictly validated Revi response is accepted. Raw-output wrappers, unknown
fields, empty answers, missing requirements, and malformed plans fail closed.
There is no OpenAI planning fallback. OpenAI remains the separate data-only
prototype generator, used only after explicit Revi plan approval.

The run-only credential can execute even when metadata and approval reads are
denied. The adapter therefore does not require a metadata/configuration preflight
or a particular agent type name. It cannot attest to native schema enforcement:
the AgenticOrg administrator must configure that separately using the supplied
schema template. Revi always enforces its own strict schema and workflow checks.

Human-review errors include the original run ID and approval-page URL. They do
not approve, poll, or resubmit runs. An externally approved result is not yet
automatically imported because the saved credential cannot read review status.
Provider review is never equivalent to approving a build in Revi.

Text planning allows up to 120 seconds; the voice webhook allows 45 seconds
inside the external tool deadline. No automatic paid retries are made.
Settings reports configuration, not health or a claimed successful plan.

The live Revi webhook check reached the configured agent and returned a
human-review-required error. No completed, validated live proposal is claimed.
The application and offline transport/validation checks passed; the provider
review/result-retrieval limitation remains.

Run offline checks with `pnpm --filter @workspace/api-server run test:planning`.
Paid live tests are explicit opt-in via `RUN_LIVE_PLANNING_TESTS=1`; do not enable
them just to recheck an existing paused run.

## Historical provisioning reference — not the active hackathon setup

The remaining notes describe the old default-host setup, not current instructions.

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

AgenticOrg prepares product plans, not executable projects. After explicit Revi
approval, the separate controlled bakery compiler generates real source files,
private previews, persistent orders and measured checks. The other four legacy
prototype renderers remain illustrative, not custom apps.

See `bakery-builder.md` for the builder boundary. A tested bakery build does not
prove that a native AgenticOrg run completed. Human-gated runs still require an
authorized completed-result retrieval path; never invent a plan or rerun a
pending provider run merely to poll it. Provider review is not Revi build approval.
