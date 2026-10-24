# BuildBuddy Voice

BuildBuddy helps someone with no coding experience describe a goal, clarify who it is for and what limits matter, approve a plan, and try a safe interactive prototype.

## What is implemented

- Beginner, Intermediate, Advanced and Pro experience levels.
- OpenAI planning through Replit AI Integrations for text and the voice webhook, one follow-up question at a time. Strict structured output and independent validation; no AgenticOrg dependency.
- PostgreSQL persistence for browser-owned conversations, understanding, plans, events, check results and review decisions.
- Explicit plan approval before generation; the UI polls backend-persisted events.
- Four supported prebuilt interactive renderers: tracker, checklist, sum/average calculator and information browser.
- Prototype interaction state saved in this browser; generated data is rendered as text, never executed.
- Server-side schema/content/type/approval checks with actual results in Review.
- Explicit accept/request-changes review and real project history.
- Failure reporting, rate limits, owner-scoped access and interrupted-work detection.

## Intentionally not connected

- **Voice:** the “Talk with voice” controls load ElevenLabs’ official widget for the linked public agent. Start/end calls in that panel and allow microphone access when prompted. Audio is handled by ElevenLabs, not the project chat backend. Voice conversations do not update saved requirements, plans, or approvals.

### ElevenLabs voice configuration

The public agent is linked in `artifacts/buildbuddy/src/components/voice-agent.tsx`. No API key is exposed or needed for this public widget. The widget only loads after a user clicks the voice control; starting a call is a separate explicit action. Agent authentication must remain compatible with public widget access. Restrict allowed domains in the agent’s ElevenLabs Security settings to this app’s preview and published domains. If a call is blocked, check those settings, microphone permissions, and the ElevenLabs account’s availability/quota. Integration status reports configuration, not live call health. Browser microphone restrictions inside an embedded preview may require opening the app in a separate tab.

The protected `POST /api/plan-project` endpoint supports Revi's planning webhook. The ElevenLabs tool and call-timing instructions are installed, with server-side shared-secret authentication. See [the setup and exact API contract](docs/elevenlabs-planning.md), [tool configuration template](docs/elevenlabs-planning-tool.template.json), and [Revi call-timing instructions](docs/revi-planning-prompt.md). The endpoint now uses OpenAI, not AgenticOrg. Republish to update the live webhook backend; the last checked published build did not include the route.
- **AgenticOrg:** removed from active planning and generation at the user's request. Its old adapter and provisioning templates are historical, unused code.
- Prototypes do not send messages, take payments, book appointments, connect external accounts, execute arbitrary code or deploy themselves.
- There is no account login, team sharing or cross-device access. Keep the browser cookie to retain access to your saved projects.

## Run in this Replit project

1. If dependencies need reinstalling, run `pnpm install --frozen-lockfile`.
2. Ensure the project's managed PostgreSQL database is available. Apply the development schema with `pnpm --filter @workspace/db run push`.
3. Open Run/workflows and start the existing workflows:
   - `artifacts/api-server: API Server`
   - `artifacts/buildbuddy: web`
4. Open the BuildBuddy Voice preview. Select an experience level and describe an idea.
5. Answer the assistant's clarifying questions, open Plan, and choose **Approve plan and start building**.
6. Watch Activity, try Preview, then inspect Review and accept or request changes.

The managed workflows supply their ports and base paths. Do not run `pnpm dev` at the workspace root.

Required server configuration:

| Setting | Purpose |
| --- | --- |
| `DATABASE_URL` | Managed PostgreSQL connection |
| `PLANNING_WEBHOOK_SECRET` | Server-to-server ElevenLabs webhook authentication |
| `AI_INTEGRATIONS_OPENAI_BASE_URL` | Replit AI Integrations endpoint for planning and prototypes |
| `AI_INTEGRATIONS_OPENAI_API_KEY` | Server-only AI Integrations credential |

Planning and data-only prototype generation use Replit AI Integrations for OpenAI access. No new user-provided key is required; usage is billed to Replit credits. This is not a coding agent or a real bakery-app builder. All credentials remain server-only, and explicit approval is required before generating a prototype.

Development checks:

```sh
pnpm run typecheck
pnpm --filter @workspace/api-spec run codegen
```

The first build passed a full workspace typecheck and API health/configuration checks. A live clarification request successfully returned a follow-up question without approving or generating a plan. Desktop and phone welcome layouts were visually checked. No automated browser interaction suite was run.

## Publish

1. Open **Publish** in Replit.
2. Choose **Reserved VM**, with **one API process/instance**. This first release runs provider calls after returning the approval response and coordinates work within that process. Do not use multiple Autoscale instances without first adding a shared job queue and distributed locking.
3. Confirm the production database and the three required server settings above in publishing configuration. Development and production settings/data are separate.
4. Use the existing artifact-managed production commands. The API builds with `pnpm --filter @workspace/api-server run build` and runs `node --enable-source-maps artifacts/api-server/dist/index.mjs`; the frontend builds with `pnpm --filter @workspace/buildbuddy run build` and serves `artifacts/buildbuddy/dist/public`.
5. Review the proposed development-to-production database schema changes in the Publish flow, choose public visibility if you want public access, and click **Publish**.
6. Open the provided published URL and create a new project there. Development conversations are not production seed data.

The application has not been published on your behalf. The publishing system supplies service environment values and routing; do not paste development URLs into app code.

## Reliability and safety boundaries

- Only explicit plan approval starts generation. A new message invalidates the old plan, prototype and approval.
- Review acceptance does not authorize deployment or changes to external accounts.
- API keys stay on the backend. AI requests have timeouts and SDK retries; failures are shown instead of simulated successes.
- If the API restarts, incomplete work is marked failed and requires a retry.
- Test results in the app are actual **structural checks**, not claims that browser interactions, accessibility or business rules were exhaustively tested.
- Initial prototype items are illustrative generated content, not live business records.
- Session cookies protect project access but are not a substitute for authenticated accounts in a multi-user production product.
