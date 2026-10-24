# Controlled bakery builder

The supported executable artifact is a bakery order tracker. A validated plan
must use kind `tracker` and explicitly identify a bakery in its goal or title.
Building only starts after the browser owner explicitly approves that plan.

This is a fixed, supported coding workflow, **not** a public Replit Agent API,
remote coding-agent integration, or execution of model-written server code.
The compiler owns every HTML/CSS/JavaScript instruction; the approved plan
supplies escaped presentation text. It installs no generated dependencies and
runs no generated shell commands. Other project kinds keep their legacy
illustrative data-only prototypes.

## Actual build

1. Allocate an independent temporary directory and build UUID.
2. Write `index.html`, `app.css`, and `app.js`.
3. Save each file privately in App Storage. PostgreSQL stores metadata and hashes,
   not generated file bytes.
4. Download stored files and compare byte lengths and SHA-256 checksums.
5. Parse the actual JavaScript without executing it and check source boundaries.
6. Exercise PostgreSQL order create/reload/update/stale-version rejection/delete
   in a unique unrouteable verification namespace; clean those records up.
7. Expose a preview URL only after all checks pass.
8. Remove the temporary directory. Durable files remain available through the
   owner-checked source/preview endpoint.

These reported checks are source/database checks, not browser interaction tests.
Build failures produce failed activities/events and no successful preview claim.
No order in the user's project is edited or deleted by build verification.

## Generated app

The actual generated app uses same-origin JSON APIs and PostgreSQL persistence:

- Customer name, items, quantity, pickup date and status.
- Add, list, edit, mark ready and delete, with explicit delete confirmation.
- Version-checked edits and deletions: stale writes return 409, never overwrite.
- Real calendar-date and bounded input validation; at most 500 orders/project.
- Browser-owned private project, not accounts, team access or public deployment.

Generated files and order routes require the existing HTTP-only browser-owner
cookie. Another browser cannot retrieve either by knowing a project UUID.
App Storage objects are not public. The trusted preview uses a restrictive CSP,
no inline script/style, no external resources, and a sandboxed iframe. Stored
order text is rendered with `textContent`, not injected as HTML. Frame ancestors
are limited to the app's own origin and the trusted `https://replit.com`
workspace wrapper, so the nested preview also works inside Replit Preview.

## Progress

`GET /api/projects/{id}/events` is an owner-checked SSE stream. It sends a current
project `snapshot`, then named real backend events. Events are persisted before
they are emitted, have stable IDs, and replay after `Last-Event-ID` on reconnect.
Heartbeats keep the connection active; listeners and connection counts are
removed on close. The UI also polls slowly as a fallback.

Event types include `plan_ready`, `approval_required`, `build_started`,
`file_changed`, `test_started`, `test_passed`, `test_failed`, `preview_ready`,
`build_completed`, and `build_failed`. They reflect actual work, not timers or
simulated milestones. Build events, file metadata, test outcomes and preview
URLs survive a browser refresh.

## Provider boundary

AgenticOrg remains the mandatory product planner. A human-gated run is not a
completed plan, and external review approval does not authorize a Revi build.
No OpenAI planning fallback was added. Source/database/bakery UI verification
may use clearly labelled isolated development fixtures; such fixtures are not
evidence of native AgenticOrg success and are never inserted into user projects.
