import { db, projectsTable } from "@workspace/db";
import { GetProjectResponse } from "@workspace/api-zod";
import { activity, message, saveProject } from "./project-store";
import { logger } from "./logger";

// This first release uses one API process (publish with Reserved VM).
// Jobs do not resume silently: an interrupted provider call needs explicit retry.
export async function recoverInterruptedProjects(): Promise<void> {
  const rows = await db.select().from(projectsTable);
  for (const row of rows) {
    const project = GetProjectResponse.parse(row.payload);
    if (project.status !== "building" && !project.activities.some(a => a.status === "running")) continue;
    for (const event of project.activities) if (event.status === "running") {
      event.status = "failed";
      event.detail = "The API process restarted before this action completed. No completion is claimed.";
    }
    project.status = project.plan ? "failed" : "discovering";
    activity(project, "Work interrupted", "The server restarted. Retry the plan or send your message again.", "failed");
    message(project, "assistant", "The server restarted before I finished. Your saved conversation is intact; please retry the plan or send your message again.");
    await saveProject(project, row.owner);
    logger.info({ projectId: project.id }, "Marked interrupted project for explicit retry");
  }
}
