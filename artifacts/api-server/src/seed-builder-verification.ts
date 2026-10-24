import { randomBytes, randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { saveProject, now, type Project } from "./lib/project-store";

if (process.env.NODE_ENV === "production" || !process.argv.includes("--run")) {
  throw new Error("Development verification only. Pass --run explicitly.");
}
const owner = randomBytes(32).toString("hex");
const id = randomUUID();
const project: Project = {
  id, title: "Bakery builder verification fixture", level: "Beginner", status: "awaiting-approval",
  requirements: { goal: "A bakery order tracker with persistent order CRUD", audience: "Bakery owner and staff",
    constraints: ["Controlled builder verification fixture only; not an AgenticOrg-generated plan"], questions: [] },
  plan: { title: "Bakery order tracker", kind: "tracker", rationale: "Exercise the actual approved-build workflow with a clearly identified development fixture.",
    steps: ["Generate HTML, CSS and JavaScript", "Run file and database checks", "Use the private order tracker"] },
  messages: [{ id: randomUUID(), role: "assistant",
    content: "Development verification fixture, not an AgenticOrg proposal. Approve explicitly to test the real bakery builder. No generation has started.",
    createdAt: now() }],
  activities: [], tests: [], events: [], reviewApproved: false, createdAt: now(), updatedAt: now(),
};
await saveProject(project, owner);
await writeFile("/tmp/revi-builder-verification.json", JSON.stringify({ owner, id, path: `/project/${id}` }), { mode: 0o600 });
console.log(JSON.stringify({ id, path: `/project/${id}`, fixtureFile: "/tmp/revi-builder-verification.json", planningProvenance: "Explicit development fixture, not AgenticOrg" }));
process.exit(0);
