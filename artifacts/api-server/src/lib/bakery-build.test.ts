import { test } from "node:test";
import assert from "node:assert/strict";
import { Script } from "node:vm";
import { renderBakeryFiles } from "./bakery-template";
import { validateOrderInput } from "./bakery-orders";
import { isGeneratedFileName, fileHash } from "./generated-storage";

test("bakery compiler emits only trusted source files with escaped configuration", () => {
  const files = renderBakeryFiles({ projectId: "p", buildId: "b", title: '<script>alert("x")</script>' });
  assert.deepEqual(Object.keys(files).sort(), ["app.css", "app.js", "index.html"]);
  assert.ok(!files["index.html"].includes('<script>alert("x")</script>'));
  new Script(files["app.js"]);
  assert.ok(!files["app.js"].includes("innerHTML"));
  assert.ok(!/\beval\s*\(|new\s+Function\s*\(/.test(files["app.js"]));
  assert.ok(files["app.js"].includes("fetch("));
  assert.ok(files["app.js"].includes("version"));
  assert.ok(!files["app.js"].includes("localStorage"));
});

test("source names reject traversal and hashes reflect actual bytes", () => {
  assert.ok(isGeneratedFileName("app.js"));
  for (const value of ["../app.js", "/index.html", "package.json", "app.js/other"]) assert.ok(!isGeneratedFileName(value));
  assert.equal(fileHash("test"), fileHash(Buffer.from("test")));
  assert.notEqual(fileHash("test"), fileHash("changed"));
});

test("order validation rejects impossible dates, blank values and unsupported types", () => {
  const valid = { customerName: "Customer", items: "Bread", quantity: 2, pickupDate: "2028-02-29", status: "received" };
  assert.equal(validateOrderInput(valid).pickupDate, "2028-02-29");
  for (const invalid of [
    { ...valid, customerName: " " }, { ...valid, items: " " },
    { ...valid, pickupDate: "2027-02-29" }, { ...valid, pickupDate: "2028-02-30" },
    { ...valid, quantity: 0 }, { ...valid, quantity: 1.5 }, { ...valid, quantity: "2" },
    { ...valid, status: "paid" }, { ...valid, owner: "someone-else" },
  ]) assert.throws(() => validateOrderInput(invalid));
});
