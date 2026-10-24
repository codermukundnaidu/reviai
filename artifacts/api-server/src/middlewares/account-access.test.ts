import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import cookieParser from "cookie-parser";
import { accountAccess } from "./account-access";

async function serve(t: TestContext, userId: string | null, claim = async (_legacy: string, _owner: string) => {}) {
  const app = express();
  app.use(express.json(), cookieParser(), accountAccess({ userId: () => userId, claim }));
  app.use((_req, res) => res.json({ owner: res.locals.owner ?? null }));
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No test port");
  return `http://127.0.0.1:${address.port}`;
}

test("account guard rejects anonymous project, preview, order and SSE requests even with a guest cookie", async t => {
  let claims = 0;
  const base = await serve(t, null, async () => { claims++; });
  for (const path of ["/projects", "/projects/id", "/projects/id/events", "/projects/id/orders", "/projects/id/builds/b/files/index.html", "/integrations"]) {
    const response = await fetch(base + path, { headers: { Cookie: `bb_session=${"a".repeat(64)}` } });
    assert.equal(response.status, 401);
    assert.equal(response.headers.get("cache-control"), "no-store");
  }
  assert.equal(claims, 0);
});

test("verified identity owns the request; old browser projects are claimed and cookie retired", async t => {
  const calls: string[][] = [];
  const base = await serve(t, "user_A", async (legacy, owner) => { calls.push([legacy, owner]); });
  const legacy = "b".repeat(64);
  const response = await fetch(base + "/projects", {
    method: "POST", headers: { "Content-Type": "application/json", Cookie: `bb_session=${legacy}` },
    body: JSON.stringify({ owner: "clerk:user_B", userId: "user_B" }),
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { owner: "clerk:user_A" });
  assert.deepEqual(calls, [[legacy, "clerk:user_A"]]);
  assert.match(response.headers.get("set-cookie") ?? "", /bb_session=;/);
});

test("malformed legacy cookie never becomes identity or claims another account", async t => {
  let claims = 0;
  const base = await serve(t, "user_A", async () => { claims++; });
  const response = await fetch(base + "/projects", { headers: { Cookie: "bb_session=clerk:user_B" } });
  assert.deepEqual(await response.json(), { owner: "clerk:user_A" });
  assert.equal(claims, 0);
});

test("cross-site writes fail before linking legacy projects", async t => {
  let claims = 0;
  const base = await serve(t, "user_A", async () => { claims++; });
  const response = await fetch(base + "/projects/id/approve", {
    method: "POST", headers: { "Sec-Fetch-Site": "cross-site", Cookie: `bb_session=${"c".repeat(64)}` },
  });
  assert.equal(response.status, 403);
  assert.equal(claims, 0);
});

test("in-flight legacy work delays claiming rather than stranding its writes", async t => {
  const base = await serve(t, "user_A", async () => { throw new Error("LEGACY_PROJECT_BUSY"); });
  const response = await fetch(base + "/projects", { headers: { Cookie: `bb_session=${"d".repeat(64)}` } });
  assert.equal(response.status, 409);
  assert.equal(response.headers.get("set-cookie"), null);
});

test("account guard leaves health and independently authenticated planning webhook routes alone", async t => {
  const base = await serve(t, null);
  assert.equal((await fetch(base + "/healthz")).status, 200);
  assert.equal((await fetch(base + "/plan-project", { method: "POST" })).status, 200);
});
