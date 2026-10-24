import type { Request, RequestHandler } from "express";
import { getAuth } from "@clerk/express";
import { claimBrowserProjects } from "../lib/project-store";
import { busyProjects } from "../lib/build-project";

type Dependencies = {
  userId: (req: Request) => string | null;
  claim: (legacyOwner: string, owner: string) => Promise<void>;
};

export function accountAccess(dependencies: Partial<Dependencies> = {}): RequestHandler {
  const userId = dependencies.userId ?? (req => getAuth(req).userId);
  const claim = dependencies.claim ?? ((legacy, owner) => claimBrowserProjects(legacy, owner, busyProjects));
  return async (req, res, next) => {
    if (!/^\/(projects|integrations)(\/|$)/.test(req.path)) { next(); return; }
    res.setHeader("Cache-Control", "no-store");
    if (req.method !== "GET" && req.get("Sec-Fetch-Site") === "cross-site") {
      res.status(403).json({ error: "Cross-site writes are not allowed" }); return;
    }
    const id = userId(req);
    if (!id) { res.status(401).json({ error: "Please sign in to access your projects." }); return; }
    // Never accept an owner or account identity from the request body or legacy cookie.
    res.locals.owner = `clerk:${id}`;
    const legacy = req.cookies?.bb_session;
    if (typeof legacy === "string" && /^[a-f0-9]{64}$/.test(legacy)) {
      try {
        await claim(legacy, res.locals.owner);
        res.clearCookie("bb_session", { path: "/", httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" });
      } catch (error) {
        if (error instanceof Error && error.message === "LEGACY_PROJECT_BUSY") {
          res.status(409).json({ error: "An existing browser project is still working. Wait for it to finish, then refresh to link it to your account." });
          return;
        }
        next(error); return;
      }
    }
    next();
  };
}
