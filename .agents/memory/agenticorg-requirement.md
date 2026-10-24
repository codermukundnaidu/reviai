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

AgenticOrg's Settings > API Keys form does not provide a per-key scope editor.
Do not send the user through repeated key rotations to resolve a role-based 403.

**Why:** Official integration documentation and console source distinguish
credential validity, route scopes, company role mapping, and administrator
authority. A newly generated key does not necessarily change that authority.
Signed-in console prompt changes were saved and independently verified even
while machine-key configuration writes were denied.

**How to apply:** Direct administrators to Settings > User Management for role
guidance; company roles live under the company's Settings > Company Role
Mapping. For denied configuration writes, have an authorized administrator
review server-side credential policy or apply the planner configuration through
their authenticated console. Never suggest nonexistent permission checkboxes or
grant broad administrator scope as a default workaround.

Evaluate execution access separately from configuration-write access.

**Why:** The native machine credential could execute the tool-free planner even
while configuration PATCH requests were denied. Planning can still pause for
human review under confidence/completeness policy despite making no tool calls.

**How to apply:** A configuration-write 403 does not prove that planning cannot
run. Use a bounded, authorized test of an already safe agent; accept only
completed, validated results. A human-gated proposal is pending review, not a
successful completed plan and never permission to build. Preserve the provider's
review gate rather than lowering thresholds or changing routes to bypass it.
