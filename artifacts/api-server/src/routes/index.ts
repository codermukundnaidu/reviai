import { Router, type IRouter } from "express";
import healthRouter from "./health";
import projectsRouter from "./projects";
import planningRouter from "./plan-project";

const router: IRouter = Router();

router.use(healthRouter);
router.use(planningRouter);
router.use(projectsRouter);

export default router;
