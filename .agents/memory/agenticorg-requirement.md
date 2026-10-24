---
name: Planning provider decision
description: Current provider decision and lessons from the retired AgenticOrg setup
---

Do not require or call AgenticOrg for Revi. Use the configured Replit AI
integration for planning and safe prototype generation.

**Why:** After repeated AgenticOrg authorization failures, the user explicitly
changed the requirement: "do without agenticorg integration". This supersedes
their earlier mandatory-provider instruction.

**How to apply:** Do not reintroduce AgenticOrg setup or permission requests.
Keep provider-enforced structured output, server validation, explicit user
approval, and implementation as separate stages. The remaining notes are
historical guidance only if the user explicitly requests AgenticOrg again.

For this project's AgenticOrg tests, use the user-provided hackathon instance:
`https://agenticorg.hackathon.pinelabs.com`, not the SDK's default
`https://app.agenticorg.ai`.

**Why:** The user supplied the SDK configuration for their instance. Its native
UUID run endpoint accepted a request even while the metadata endpoint denied
access. Earlier default-host errors did not establish credential validity on
the intended instance.

**How to apply:** A request to test another agent does not itself restore
AgenticOrg as Revi's provider. Use UUID execution with the documented `task`
input, distinguish metadata permissions from execution permissions, and inspect
the returned status and sanitized error rather than treating HTTP 200 as a
completed plan. Do not send credentials across hosts through redirects.

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
