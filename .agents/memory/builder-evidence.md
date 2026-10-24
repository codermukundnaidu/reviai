---
name: Builder verification evidence
description: Keep evidence of executable builds separate from evidence of mandatory native planning.
---

A passing builder test using an approved development fixture is not evidence that AgenticOrg returned a completed product plan.

**Why:** The builder can work independently while the mandatory planner remains human-gated or lacks authorized resumed-result retrieval. Conflating these states would falsely imply the complete user journey works.

**How to apply:** Test fixtures must be clearly labelled, isolated from existing user projects, and never presented as native proposals. Report builder verification and live planner status separately. Never bypass provider review or silently substitute another planner to make the demonstration succeed.
