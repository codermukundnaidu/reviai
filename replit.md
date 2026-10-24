# BuildBuddy Voice

A goal-first AI developer companion for non-programmers, with approved plans, safe data-driven prototypes, and truthful workflow status.

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
- `artifacts/api-server/src/routes/projects.ts`: browser-owned project endpoints.
- `artifacts/api-server/src/lib`: AI clarification, prototype generation, persistence and restart recovery.
- `lib/api-spec/openapi.yaml`: source-of-truth contract; regenerate clients after edits.
- `lib/db/src/schema/projects.ts`: project persistence.

## Architecture decisions

- Publish on **Reserved VM with a single API process**, not multiple Autoscale instances: this release has process-local job coordination and background provider calls. A restart marks interrupted work failed and requires explicit retry.
- Prototype generation returns only validated data for four prebuilt React renderers. This intentionally limits scope to avoid executing untrusted model code.
- No accounts were requested. Projects are owned by an opaque, httpOnly browser cookie, not shared across devices; clearing cookies loses access.
- AgenticOrg is an optional adapter contract, not a claimed native/provider-tested integration. No AgenticOrg response or execution log is fabricated.

## Product

- Select Beginner, Intermediate, Advanced or Pro, clarify an idea through AI text conversation, inspect understanding and explicitly approve a plan.
- Supported prototype kinds: tracker, checklist, sum/average calculator, information browser. Interactive preview changes stay in localStorage; conversations and plans are in PostgreSQL.
- Inspect backend-persisted activity, actual structural checks, review decisions and project history.
- Voice uses the official ElevenLabs public-agent widget, loaded on demand from the home/project microphone controls. Calls remain separate from saved project chat and must not bypass explicit plan approvals. No ElevenLabs API key is required for this public embed.

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
