import { activity, message, saveProject, type Project } from "./project-store";
import { generatePrototype, prototypeSchema } from "./buddy-agent";
import { logger } from "./logger";
import { isBakeryPlan, buildBakeryProject } from "./bakery-build";
import { recordProjectEvent } from "./project-events";

// All mutations for a project are serialized within the single API process.
export const busyProjects = new Set<string>();
export async function buildProject(project: Project, owner: string): Promise<void> {
  if (isBakeryPlan(project)) {
    try { await buildBakeryProject(project, owner); } finally { busyProjects.delete(project.id); }
    return;
  }
  project.build = undefined;
  let current = activity(project, "Generating prototype", "Generating safe prototype data with OpenAI through Replit AI Integrations.", "running");
  try {
    await recordProjectEvent(project, owner, "build_started", "Generating the approved legacy data-only prototype; no source-code app is claimed.");
    const prototype = await generatePrototype(project);
    current.status = "completed";
    current.detail = "Prototype data returned and validated against the supported data contract.";
    current = activity(project, "Checking prototype", "Running server-side structural and approval checks. These are not browser interaction tests.", "running");
    await saveProject(project, owner);
    project.prototype = prototype;
    const checks = [
      { name: "Prototype data schema", check: () => prototypeSchema.safeParse(prototype).success, detail: "Validated required fields and rejected unknown properties." },
      { name: "Approved prototype type", check: () => prototype.kind === project.plan?.kind, detail: "Compared generated kind against the explicitly approved plan." },
      { name: "Usable starting content", check: () => prototype.items.length > 0 && prototype.items.every(item => item.trim().length > 0), detail: "Checked that every initial item contains non-empty text." },
      { name: "No executable payload", check: () => !JSON.stringify(prototype).match(/<script|javascript:|onerror\s*=/i), detail: "Scanned data for common executable markup; rendering uses React text only, never generated code." },
      { name: "Plan approval recorded", check: () => project.activities.some(a => a.title === "Plan approved" && a.status === "completed"), detail: "Verified explicit approval event exists before generation." },
    ];
    project.tests = [];
    for (const test of checks) {
      await recordProjectEvent(project, owner, "test_started", test.name);
      const passed = test.check();
      project.tests.push({ name: test.name, passed, detail: test.detail });
      await recordProjectEvent(project, owner, passed ? "test_passed" : "test_failed", `${test.name}: ${test.detail}`);
    }
    const passed = project.tests.every(test => test.passed);
    current.status = passed ? "completed" : "failed";
    current.detail = `${project.tests.filter(t => t.passed).length}/${project.tests.length} structural checks passed. Browser behavior has not been automatically tested.`;
    project.status = passed ? "ready" : "failed";
    activity(project, passed ? "Ready for your review" : "Prototype checks failed",
      passed ? "Open the interactive preview, then approve or request changes." : "Review the actual check results before retrying.", passed ? "awaiting-approval" : "failed");
    message(project, "assistant", passed
      ? "Your prototype is ready. I generated data for a supported, prebuilt interactive tool and ran the structural checks shown in Review. No external service was changed or deployed. Try the preview, then approve it or tell me what to change."
      : "The generated prototype did not pass all structural checks. Review the results and tell me what to change; I have not marked it ready.");
    await recordProjectEvent(project, owner, passed ? "build_completed" : "build_failed", current.detail);
  } catch (err) {
    logger.error({ err, projectId: project.id }, "Prototype generation failed");
    current.status = "failed";
    current.detail = "Generation failed or the provider returned invalid data. No successful build is claimed.";
    project.status = "failed";
    message(project, "assistant", "I couldn't complete this prototype. You can retry the approved plan, or send a message to revise it. No external changes were made.");
    await recordProjectEvent(project, owner, "build_failed", current.detail).catch(error => logger.error({ error }, "Failed to persist generation error"));
  } finally {
    busyProjects.delete(project.id);
  }
}
