import { test } from "node:test";
import assert from "node:assert/strict";
import { autoApprovePlan, hasBuildAuthorization } from "./build-authorization";
import type { Project } from "./project-store";

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: "project-1",
    title: "Bakery tracker",
    level: "Beginner",
    status: "awaiting-approval",
    requirements: { goal: "Bakery order tracker", audience: "Bakery staff", constraints: [], questions: [] },
    plan: { title: "Bakery tracker", kind: "tracker", rationale: "Track orders.", steps: ["Create orders", "Mark orders ready"] },
    messages: [],
    activities: [{ id: "event-1", title: "Plan awaiting approval", detail: "Old prompt", status: "awaiting-approval", createdAt: new Date().toISOString() }],
    tests: [{ name: "old check", passed: false, detail: "stale" }],
    reviewApproved: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

test("validated ready plans auto-authorize one controlled build without a user approval event", () => {
  const project = makeProject();
  assert.equal(autoApprovePlan(project), true);
  assert.equal(project.status, "building");
  assert.equal(project.tests.length, 0);
  assert.equal(project.prototype, undefined);
  assert.equal(project.reviewApproved, false);
  assert.ok(hasBuildAuthorization(project));
  assert.equal(project.activities.at(-1)?.title, "Plan auto-approved");
  assert.equal(project.activities.at(-1)?.status, "completed");
  assert.equal(project.activities[0]?.status, "completed");
  assert.equal(autoApprovePlan(project), false);
});

test("clarification, missing plans, and provider-review holds cannot auto-authorize a build", () => {
  const clarification = makeProject({
    status: "discovering",
    requirements: { goal: "Bakery", audience: "", constraints: [], questions: ["Who is this for?"] },
    plan: undefined,
  });
  const providerReview = makeProject({ status: "awaiting-approval", plan: undefined });
  assert.equal(autoApprovePlan(clarification), false);
  assert.equal(autoApprovePlan(providerReview), false);
  assert.equal(clarification.status, "discovering");
  assert.equal(providerReview.status, "awaiting-approval");
  assert.equal(hasBuildAuthorization(clarification), false);
  assert.equal(hasBuildAuthorization(providerReview), false);
});

test("legacy explicit approval events remain valid build authorization", () => {
  const project = makeProject({
    status: "building",
    activities: [{ id: "event-legacy", title: "Plan approved", detail: "Previous approval", status: "completed", createdAt: new Date().toISOString() }],
  });
  assert.equal(hasBuildAuthorization(project), true);
});
