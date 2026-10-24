import { build } from "esbuild";
import { spawnSync } from "node:child_process";

await build({
  stdin: {
    contents: 'import "./src/lib/plan-project.test.ts"; import "./src/lib/agenticorg-planner.test.ts"; import "./src/lib/bakery-build.test.ts"; import "./src/lib/build-authorization.test.ts"; import "./src/middlewares/account-access.test.ts";',
    resolveDir: process.cwd(),
    loader: "ts",
  },
  outfile: "dist/planning.test.mjs",
  bundle: true,
  platform: "node",
  format: "esm",
  external: ["express", "pino-http", "pino", "@google-cloud/storage", "@clerk/express"],
  banner: { js: 'import { createRequire } from "node:module"; const require = createRequire(import.meta.url);' },
});
const result = spawnSync(process.execPath, ["--test", ...process.argv.slice(2), "dist/planning.test.mjs"], { stdio: "inherit" });
process.exit(result.status ?? 1);
