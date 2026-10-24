import { Router, type IRouter } from "express";
import { DeleteOrderBody } from "@workspace/api-zod";
import { loadProject } from "../lib/project-store";
import { isGeneratedFileName, readGeneratedFile } from "../lib/generated-storage";
import { createBakeryOrder, listBakeryOrders, updateBakeryOrder, deleteBakeryOrder, OrderError } from "../lib/bakery-orders";

// Mounted after the existing browser-owner, CSRF, no-store, and write-budget middleware.
const router: IRouter = Router();
router.get("/projects/:id/builds/:buildId/files/:file", async (req, res) => {
  const { id, buildId, file } = req.params;
  const project = await loadProject(String(id), res.locals.owner);
  if (!project || project.build?.id !== buildId || !isGeneratedFileName(String(file)) ||
      !project.build.files.some(f => f.name === file)) {
    res.status(404).json({ error: "Build file not found in your account." }); return;
  }
  if (project.build.status !== "ready" && req.query.download !== "1") {
    res.status(409).json({ error: "The generated preview is not ready." }); return;
  }
  const content = await readGeneratedFile(project.id, project.build.id, file as "index.html" | "app.css" | "app.js");
  res.setHeader("X-Content-Type-Options", "nosniff");
  // Replit Preview adds a cross-origin outer workspace iframe; all ancestors
  // must be permitted, not just our direct same-origin project page.
  res.setHeader("Content-Security-Policy", "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'none'; frame-ancestors 'self' https://replit.com");
  res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
  if (req.query.download === "1") res.setHeader("Content-Disposition", `attachment; filename="${file}"`);
  res.type(file === "index.html" ? "html" : file === "app.css" ? "css" : "text/javascript").send(content);
});

router.use("/projects/:id/orders", async (req, res, next) => {
  const project = await loadProject(String(req.params.id), res.locals.owner);
  if (!project || project.build?.kind !== "bakery-order-tracker") {
    res.status(404).json({ error: "Bakery app not found in your account." }); return;
  }
  if (project.build.status !== "ready") {
    res.status(409).json({ error: "Wait until the bakery app has completed its build checks." }); return;
  }
  res.locals.bakeryProjectId = project.id;
  next();
});
router.get("/projects/:id/orders", async (_req, res) => {
  res.json(await listBakeryOrders(res.locals.bakeryProjectId));
});
router.post("/projects/:id/orders", async (req, res, next) => {
  try { res.status(201).json(await createBakeryOrder(res.locals.bakeryProjectId, req.body)); } catch (error) { next(error); }
});
router.put("/projects/:id/orders/:orderId", async (req, res, next) => {
  try { res.json(await updateBakeryOrder(res.locals.bakeryProjectId, String(req.params.orderId), req.body)); } catch (error) { next(error); }
});
router.delete("/projects/:id/orders/:orderId", async (req, res, next) => {
  try {
    const body = DeleteOrderBody.strict().safeParse(req.body);
    if (!body.success) throw new OrderError(400, "The current order version is required to delete it.");
    await deleteBakeryOrder(res.locals.bakeryProjectId, String(req.params.orderId), body.data.version);
    res.status(204).end();
  } catch (error) { next(error); }
});
router.use((error: unknown, _req: unknown, res: import("express").Response, next: import("express").NextFunction) => {
  if (error instanceof OrderError) res.status(error.status).json({ error: error.message });
  else next(error);
});
export default router;
