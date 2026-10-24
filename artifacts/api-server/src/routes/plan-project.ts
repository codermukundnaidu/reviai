import { Router, type IRouter } from "express";
import { createHash, timingSafeEqual } from "node:crypto";
import { PlanProjectBody, type PlanningInput } from "@workspace/api-zod";
import { planFromIdea, validatePlanningResult } from "../lib/plan-project";
import { isPlanningConfigured } from "../lib/buddy-agent";
import { AgenticOrgPlanningError } from "../lib/agenticorg-planner";

type Planner = (input: PlanningInput) => Promise<unknown>;
type Options = {
  planner?: Planner;
  getSecret?: () => string | undefined;
  isConfigured?: () => boolean;
};
const digest = (value: string) => createHash("sha256").update(value).digest();

export function createPlanningRouter(options: Options = {}): IRouter {
  const router = Router();
  const planner = options.planner ?? planFromIdea;
  const getSecret = options.getSecret ?? (() => process.env.PLANNING_WEBHOOK_SECRET);
  const isConfigured = options.isConfigured ?? isPlanningConfigured;
  type Result = ReturnType<typeof validatePlanningResult>;
  const cache = new Map<string, { expires: number; result: Promise<Result> }>();
  let active = 0;
  let count = 0;
  let windowEnd = 0;

  router.post("/plan-project", async (req, res): Promise<void> => {
    res.setHeader("Cache-Control", "no-store");
    const secret = getSecret();
    if (!secret || secret.length < 32) {
      res.status(503).json({ error: "Planning webhook authentication is not configured" }); return;
    }
    const authorization = req.get("Authorization") ?? "";
    if (!authorization.startsWith("Bearer ") ||
        !timingSafeEqual(digest(authorization.slice(7)), digest(secret))) {
      res.status(401).json({ error: "Invalid planning webhook credentials" }); return;
    }
    if (!req.is("application/json")) {
      res.status(415).json({ error: "Content-Type must be application/json" }); return;
    }
    const parsed = PlanProjectBody.strict().safeParse(req.body);
    if (!parsed.success || !parsed.data.idea.trim() || parsed.data.constraints?.some(value => !value.trim())) {
      res.status(400).json({ error: "Expected idea, experience_level, context, and optionally constraints, within the documented limits" }); return;
    }
    if (!isConfigured()) {
      res.status(503).json({ error: "AgenticOrg planning is not configured." }); return;
    }

    const now = Date.now();
    for (const [key, value] of cache) if (value.expires <= now) cache.delete(key);
    // Cache only hashes and validated results, not raw transcripts. Deduplicate retries and concurrent identical calls.
    const key = digest(JSON.stringify(parsed.data)).toString("hex");
    const existing = cache.get(key);
    if (!existing) {
      if (windowEnd <= now) { count = 0; windowEnd = now + 60000; }
      if (active >= 3 || count >= 20) {
        res.setHeader("Retry-After", "60");
        res.status(429).json({ error: "Planning is busy. Wait before trying again; do not retry after every sentence." }); return;
      }
      count++;
      active++;
      const result = Promise.resolve().then(() => planner(parsed.data))
        .then(validatePlanningResult)
        .finally(() => { active--; });
      cache.set(key, { expires: now + 120000, result });
      // Failed calls must not become cached successes.
      void result.catch(() => { cache.delete(key); });
    }
    try {
      const result = await cache.get(key)!.result;
      res.json(result);
    } catch (error) {
      // Do not log provider error payloads: they may include conversation context.
      req.log.warn({ errorType: error instanceof Error ? error.name : "UnknownError" }, "Planning failed");
      res.status(502).json({ error: error instanceof AgenticOrgPlanningError ? error.message : "The planner could not return a valid plan. No project was built or approved." });
    }
  });
  return router;
}

export default createPlanningRouter();
