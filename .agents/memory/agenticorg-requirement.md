---
name: Mandatory AgenticOrg planning
description: User-required provider and external lifecycle distinction for Revi product planning
---

AgenticOrg is mandatory for Revi's product planning. Do not substitute another
planner or silently fall back to OpenAI.

**Why:** The user selected configuring AgenticOrg before the bakery-builder MVP
and repeated, "AgenticOrg is mandatory."

**How to apply:** Fail explicitly when native AgenticOrg authorization,
configuration, execution, or output validation fails. Keep planning, explicit
user approval, and implementation as separate stages.

Shadow status alone does not mean an AgenticOrg agent cannot run.

**Why:** AgenticOrg's documented native runtime permits shadow test execution.
The meaningful checks are authorized access, appropriate tool permissions,
runtime results, and lifecycle/governance policy—not promotion merely to obtain
a test result.

**How to apply:** Test a tool-free planning agent without activating unrelated
business tools or bypassing approval controls. A configured template is not
evidence of a successful provider run.
