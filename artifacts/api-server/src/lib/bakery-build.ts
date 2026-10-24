import { randomUUID } from "node:crypto";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Script } from "node:vm";
import { activity, message, now, saveProject, type Project } from "./project-store";
import { renderBakeryFiles } from "./bakery-template";
import { generatedFileNames, saveGeneratedFile, readGeneratedFile, fileHash } from "./generated-storage";
import { recordProjectEvent } from "./project-events";
import { createBakeryOrder, listBakeryOrders, updateBakeryOrder, deleteBakeryOrder, cleanVerificationOrders, OrderError } from "./bakery-orders";
import { logger } from "./logger";

export function isBakeryPlan(project: Project) {
  return project.plan?.kind === "tracker" &&
    /\bbakery\b|\bbakers?\b/i.test(`${project.plan.title} ${project.requirements.goal} ${project.title}`);
}

/** Controlled single-artifact compiler, not arbitrary model-code execution. */
export async function buildBakeryProject(project: Project, owner: string) {
  let workspace: string | undefined;
  const scope = `__verification_${randomUUID()}`;
  let current = activity(project, "Starting bakery builder", "Preparing a private workspace for the approved bakery app.", "running");
  try {
    if (!isBakeryPlan(project) || project.status !== "building" ||
        !project.activities.some(event => event.title === "Plan approved" && event.status === "completed")) {
      throw new Error("Explicit plan approval is required");
    }
    const id = randomUUID();
    workspace = await mkdtemp(join(tmpdir(), "revi-bakery-"));
    project.build = { id, kind: "bakery-order-tracker", status: "building", files: [], createdAt: now() };
    project.prototype = undefined;
    project.tests = [];
    await recordProjectEvent(project, owner, "build_started", "Controlled bakery build started in an isolated temporary workspace.");
    const files = renderBakeryFiles({ projectId: project.id, buildId: id, title: project.plan!.title });
    for (const name of generatedFileNames) {
      await writeFile(join(workspace, name), files[name], { flag: "wx" });
      const file = await saveGeneratedFile(project.id, id, name, files[name]);
      project.build.files.push(file);
      activity(project, `Generated ${name}`, `${file.bytes} bytes saved privately; SHA-256 ${file.sha256.slice(0, 16)}…`, "completed");
      await recordProjectEvent(project, owner, "file_changed", `${name} written and persisted (${file.bytes} bytes).`);
    }
    current.status = "completed";
    current.detail = "Generated real HTML, CSS, and JavaScript files and stored each in App Storage.";
    current = activity(project, "Testing generated bakery app", "Checking stored source files, JavaScript syntax, and real PostgreSQL order behavior. These are not browser interaction tests.", "running");
    const check = async (name: string, run: () => Promise<string> | string) => {
      await recordProjectEvent(project, owner, "test_started", name);
      try {
        const detail = await run();
        project.tests.push({ name, passed: true, detail });
        await recordProjectEvent(project, owner, "test_passed", `${name}: ${detail}`);
      } catch {
        project.tests.push({ name, passed: false, detail: "The actual check failed; no successful result is claimed." });
        await recordProjectEvent(project, owner, "test_failed", name);
      }
    };
    await check("Persisted source integrity", async () => {
      for (const file of project.build!.files) {
        const content = await readGeneratedFile(project.id, id, file.name as typeof generatedFileNames[number]);
        if (fileHash(content) !== file.sha256 || content.length !== file.bytes) throw new Error("Integrity mismatch");
      }
      return "Downloaded all three stored files and matched their bytes and SHA-256 checksums.";
    });
    await check("Generated JavaScript syntax", () => {
      new Script(files["app.js"], { filename: "app.js" });
      return "Node parsed the actual generated JavaScript without running it.";
    });
    await check("Approved source boundary", () => {
      if (generatedFileNames.some(name => !files[name].trim()) ||
          /<script\b[^>]*>[\s\S]*?\S[\s\S]*?<\/script>/i.test(files["index.html"]) ||
          /\beval\s*\(|new\s+Function\s*\(/.test(files["app.js"])) throw new Error("Unsafe source");
      return "Only the three compiler-owned files are emitted; no inline scripts, eval, package installs, or model-written code are executed.";
    });
    await check("Persistent order create and reload", async () => {
      const input = { customerName: "Builder verification", items: "Bread", quantity: 2, pickupDate: "2030-01-15", status: "received" };
      const order = await createBakeryOrder(scope, input);
      const saved = (await listBakeryOrders(scope)).find(row => row.id === order.id);
      if (!saved || saved.customerName !== input.customerName || saved.quantity !== 2) throw new Error("Order was not persisted");
      return "Created an isolated verification order and loaded it back from PostgreSQL.";
    });
    await check("Order edit, status, and stale-write protection", async () => {
      const [order] = await listBakeryOrders(scope);
      if (!order) throw new Error("Missing verification order");
      const input = { customerName: order.customerName, items: "Bread and cake", quantity: 3,
        pickupDate: order.pickupDate, status: "ready", version: order.version };
      const updated = await updateBakeryOrder(scope, order.id, input);
      if (updated.status !== "ready" || updated.quantity !== 3 || updated.version !== order.version + 1) throw new Error("Update failed");
      let rejected = false;
      try { await updateBakeryOrder(scope, order.id, input); } catch (error) {
        rejected = error instanceof OrderError && error.status === 409;
      }
      if (!rejected) throw new Error("Stale update accepted");
      return "Persisted an edit and Ready status; rejected a stale version with a conflict.";
    });
    await check("Order delete and project isolation", async () => {
      const [order] = await listBakeryOrders(scope);
      if (!order || (await listBakeryOrders(`${scope}_other`)).length) throw new Error("Isolation failed");
      await deleteBakeryOrder(scope, order.id, order.version);
      if ((await listBakeryOrders(scope)).length) throw new Error("Delete failed");
      return "Deleted the verification record and confirmed project-scoped queries do not mix records.";
    });
    await cleanVerificationOrders(scope);
    if (!project.tests.every(test => test.passed)) throw new Error("Generated app checks failed");
    current.status = "completed";
    current.detail = `${project.tests.length}/${project.tests.length} actual source/database checks passed. Browser interactions were not tested by this build.`;
    project.build.status = "ready";
    project.build.previewUrl = `/api/projects/${project.id}/builds/${id}/files/index.html`;
    await recordProjectEvent(project, owner, "preview_ready", `Generated app available at ${project.build.previewUrl}`);
    project.status = "ready";
    activity(project, "Bakery app ready for review", "Open the actual generated preview. Orders persist in this project's PostgreSQL records.", "awaiting-approval");
    message(project, "assistant", "Your bakery order tracker has been built from the approved plan using the supported controlled workflow. The generated HTML, CSS and JavaScript are available in Preview, and the actual checks are in Review. You can add, edit, mark ready and delete orders; records persist after refresh. This is private to your account, not a separately published app or an arbitrary coding-agent build.");
    await recordProjectEvent(project, owner, "build_completed", "Bakery app generated, stored, checked, and ready for your review.");
  } catch (error) {
    logger.error({ errorType: error instanceof Error ? error.name : "UnknownError", projectId: project.id }, "Bakery build failed");
    current.status = "failed";
    current.detail = "The build or a real check failed. No successful preview is claimed.";
    project.status = "failed";
    if (project.build) { project.build.status = "failed"; project.build.previewUrl = undefined; }
    message(project, "assistant", "The bakery build did not complete. Review the actual activity and test results before retrying the approved plan. Existing bakery orders were not changed by the build.");
    await recordProjectEvent(project, owner, "build_failed", current.detail).catch(() => saveProject(project, owner));
  } finally {
    await cleanVerificationOrders(scope).catch(() => {});
    if (workspace) await rm(workspace, { recursive: true, force: true });
  }
}
