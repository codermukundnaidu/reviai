---
name: AI response contracts
description: Why workflow-critical model responses require strict structured output rather than JSON mode alone
---

Require strict JSON Schema structured output for model responses that update requirements, plans or prototype state, followed by application validation.

**Why:** A live clarification response in ordinary JSON mode omitted a required unresolved-questions array despite an explicit prompt. Syntactically valid JSON is not a reliable application contract.

**How to apply:** When changing the model or response fields, keep the provider-enforced schema and server validator aligned. Never fill in missing workflow-critical fields and claim the provider supplied them.
