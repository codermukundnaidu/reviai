---
name: Planning provider decision
description: Provider choice, hackathon instance, and runtime/permission distinctions
---

The user explicitly requested, "reconnect AgenticOrg to Revi." This supersedes
their earlier removal of the integration. AgenticOrg is the planner; OpenAI
remains the separate approved prototype generator, not a planning fallback.

**Why:** The user first removed AgenticOrg after authorization failures, then
tested their hackathon instance and explicitly requested reconnection.

**How to apply:** Keep server validation, AgenticOrg provider review, and
implementation separate. Revi automatically authorizes a ready plan only after
it passes strict validation; never auto-approve AgenticOrg HITL or build from a
pending, incomplete, or invalid result. Do not describe configured credentials,
HTTP 200, or a human-approved provider review as proof of a completed valid plan.

**Why:** The user explicitly chose to remove Revi's per-plan confirmation and
start the controlled build automatically, while distinguishing that gate from
AgenticOrg's own human review.

**How to apply:** Auto-build only completed, validated ready plans. Clarification
questions, provider HITL, invalid results, or incomplete requirements must not
authorize a build. Automatic build approval does not publish or deploy.

For this project's AgenticOrg tests, use the user-provided hackathon instance:
`https://agenticorg.hackathon.pinelabs.com`, not the SDK's default
`https://app.agenticorg.ai`.

**Why:** The user supplied the SDK configuration for their instance. Its native
UUID run endpoint accepted a request even while the metadata endpoint denied
access. Earlier default-host errors did not establish credential validity on
the intended instance.

**How to apply:** A request to test another agent does not itself restore
AgenticOrg as Revi's provider; the subsequent explicit reconnection request did.
Use UUID execution with the documented `task`
input, distinguish metadata permissions from execution permissions, and inspect
the returned status and sanitized error rather than treating HTTP 200 as a
completed plan. Do not send credentials across hosts through redirects.

Use the least-privilege run interface without inventing a metadata-read requirement.

**Why:** The hackathon credential could execute native UUID runs but received
401 on metadata and approval reads. The old default-host adapter also demanded
an arbitrary agent type name, which is not a requirement of the native run API.

**How to apply:** Target only the administrator-configured dedicated planner.
Send the expected schema in the task and validate completed output strictly.
Native schema enforcement is an administrator configuration, not something Revi
can attest to through a run-only key. Do not weaken validation, fake confidence,
or perform privileged review decisions to work around access restrictions.

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

Investigate the final answer before changing a confidence policy.

**Why:** AgenticOrg's public runtime can compute confidence from output shape
and length; an empty or unparseable answer can therefore trigger review without
containing a usable proposal. Approval does not repair that missing content.

**How to apply:** Check final answer text, JSON structure, provider content-block
handling and truncation when review contains no summary. Do not force a fixed
high confidence or lower the review threshold to mask an invalid answer.

Evaluate execution access separately from configuration-write access.

**Why:** The native machine credential could execute the tool-free planner even
while configuration PATCH requests were denied. Planning can still pause for
human review under confidence/completeness policy despite making no tool calls.

**How to apply:** A configuration-write 403 does not prove that planning cannot
run. Use a bounded, authorized test of an already safe agent; accept only
completed, validated results. A human-gated proposal is pending review, not a
successful completed plan and never permission to build. Preserve the provider's
review gate rather than lowering thresholds or changing routes to bypass it.
