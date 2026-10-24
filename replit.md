# BuildBuddy Voice

A goal-first AI developer companion for non-programmers, with approved plans, a controlled real bakery app builder, legacy data-driven prototypes, and truthful live workflow status.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Frontend: `artifacts/buildbuddy: web`; backend: `artifacts/api-server: API Server`. Use the existing managed workflows (Run).
- Required env: `DATABASE_URL`, `AI_INTEGRATIONS_OPENAI_BASE_URL`, `AI_INTEGRATIONS_OPENAI_API_KEY`. Replit AI Integration provisions the AI settings; do not expose them in frontend code.
- See `README.md` for run/publish instructions and `docs/agenticorg.md` for the optional adapter contract.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/buildbuddy/src`: React screens, theme, controlled prototype renderers.
- `artifacts/api-server/src/routes/projects.ts`: authenticated, account-owned project endpoints.
- `artifacts/api-server/src/lib`: AI clarification, prototype generation, persistence and restart recovery.
- `lib/api-spec/openapi.yaml`: source-of-truth contract; regenerate clients after edits.
- `lib/db/src/schema/projects.ts`: project persistence.

## Architecture decisions

- Publish on **Reserved VM with a single API process**, not multiple Autoscale instances: this release has process-local job coordination and background provider calls. A restart marks interrupted work failed and requires explicit retry.
- Prototype generation returns only validated data for four prebuilt React renderers. This intentionally limits scope to avoid executing untrusted model code.
- Authentication uses Replit-managed Clerk with branded local sign-in/sign-up and the canonical production proxy. Projects are owned by verified `clerk:<userId>` server identity, never a client-supplied owner or guest cookie fallback.
- First authenticated access claims projects proven by the existing unguessable `bb_session` cookie, atomically preserving project payloads, previews, and order records. Clear that legacy cookie only after success; delay migration while old work is active. **Why:** adding accounts must not discard existing user work or strand in-flight writes.
- Health and the independently bearer-authenticated ElevenLabs planning webhook remain outside account enforcement. All project, preview, order, integration-status, and SSE routes require account authentication. User changes clear browser query caches and unmount live streams.
- The user explicitly reconnected AgenticOrg as Revi's text/webhook planner. Use the configured hackathon instance and native UUID run endpoint with inputs.task; do not silently fall back to OpenAI for planning. Strictly validate completed tool-free results, and show failed or human-gated runs honestly. OpenAI through Replit AI Integrations is still the separate approved prototype generator. Keep explicit Revi approval before generation.

## Product

- Select Beginner, Intermediate, Advanced or Pro, clarify an idea through AI text conversation, inspect understanding and explicitly approve a plan.
- Real builder MVP: explicitly approved bakery tracker plans compile into trusted HTML/CSS/JavaScript in a private temporary workspace, with durable source files in App Storage, a private executable preview, and real checks. It is a constrained coding workflow, not a programmatic Replit Agent API or arbitrary model-code execution. See `docs/bakery-builder.md`.
- Bakery orders persist in PostgreSQL with project ownership checks and optimistic concurrency. Legacy tracker/checklist/calculator/information prototypes remain data-only/localStorage. Keep those capabilities distinct.
- Project progress uses SSE with persisted event IDs and replay. Emit events only for actual backend work; never use hardcoded progress animations or invent test passes.
- Inspect backend-persisted activity, actual structural checks, review decisions and project history.
- Voice uses the official ElevenLabs public-agent widget, loaded on demand from the home/project microphone controls. Calls remain separate from saved project chat and must not bypass explicit plan approvals. No ElevenLabs API key is required for this public embed.
- Revi must call `understand_and_plan_project` only once the user's idea is sufficiently understood, not after every sentence. Acknowledgements and approvals do not trigger replanning; meaningful revisions or answered clarification questions can.
- Planning webhook authentication is server-to-server only. Never expose `PLANNING_WEBHOOK_SECRET` to the browser or make planning calls count as approval/build actions. Live ElevenLabs tool installation is separate from implementing the API.

## User preferences

- Discover the actual goal before recommending a solution; do not assume every idea needs a website.
- Ask one useful follow-up at a time, adapt to experience, and challenge conflicting choices respectfully.
- Never claim actions or tests that have not occurred. Obtain approval before generation and consequential actions.
- Build one reliable end-to-end journey before adding features. User requested charcoal/off-white, subtle green, rounded panels and minimal animation.

## Gotchas

- Structural checks shown in-app are not browser tests. First-build checks covered typechecking, visible desktop/mobile entry screens, API health/configuration and a live AI clarification request; no browser interaction suite was run.
- AI output must use strict structured response contracts and still pass Zod validation.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
