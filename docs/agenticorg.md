# Optional AgenticOrg backend adapter

No AgenticOrg connection is currently configured. Normal prototype generation uses Replit AI Integrations for OpenAI. The app does not fabricate AgenticOrg outputs or logs.

This is a documented HTTP integration point, **not a verified native AgenticOrg SDK implementation**. If your AgenticOrg deployment uses a different API, put a small trusted bridge in front of it or adapt `buddy-agent.ts` to its documented contract.

## Configure

Use Replit's Secrets/publishing configuration—not chat or frontend source—to provide:

- `AGENTICORG_URL`: the complete HTTPS endpoint of a trusted adapter you control.
- `AGENTICORG_API_KEY`: its bearer credential.

Both settings must exist to enable the adapter. Restart the API workflow after configuring development settings; configure production values separately when publishing. The Settings screen reports connection **configuration**, not a successful provider health check.

## Request contract

Only after the user explicitly approves a plan, the backend sends an HTTPS POST:

```http
Content-Type: application/json
Authorization: Bearer <server-only credential>
```

```json
{
  "projectId": "opaque-project-id",
  "experienceLevel": "Beginner",
  "requirements": {
    "goal": "Keep daily tasks visible",
    "audience": "Only me",
    "constraints": ["No paid external services"],
    "questions": []
  },
  "approvedPlan": {
    "title": "Daily task checklist",
    "kind": "checklist",
    "rationale": "A checklist is sufficient; a website is not necessary.",
    "steps": ["Create a task list", "Try checking off and adding items"]
  },
  "outputContract": {
    "prototype": {
      "kind": "checklist",
      "title": "string",
      "description": "string",
      "items": ["string"]
    }
  }
}
```

## Required response

Return HTTP 200 and JSON with a `prototype` property:

```json
{
  "prototype": {
    "kind": "checklist",
    "title": "My daily tasks",
    "description": "A local prototype with illustrative starting content.",
    "items": ["Review today's priorities", "Complete the most important task"]
  }
}
```

Supported kinds are `tracker`, `checklist`, `calculator`, `information`, and the kind must match the approved plan. Title: 1–160 characters. Description: 1–3000. Items: 1–20 non-empty strings, each at most 1000 characters. No extra properties inside `prototype`.

- Calculator: unique input labels; the renderer sums inputs and shows their average. No custom formulas.
- Information: each item is `Heading: paragraph body`.
- Tracker/checklist: short actionable labels.

No HTML, JavaScript, executable artifacts, external account operations or provider-supplied execution logs are accepted. The adapter should only prepare prototype data, not perform consequential external actions.

The backend validates the returned data, runs structural checks, and persists the real success/failure events. An invalid response, timeout, redirect or HTTP error becomes a failed action. There is no silent fallback from a configured failing adapter to another provider.
