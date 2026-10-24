import { build } from "esbuild";
import { spawnSync } from "node:child_process";

await build({
  stdin: {
    contents: 'import "./src/lib/plan-project.test.ts"; import "./src/lib/agenticorg-planner.test.ts";',
    resolveDir: process.cwd(),
    loader: "ts",
  },
  outfile: "dist/planning.test.mjs",
  bundle: true,
  platform: "node",
  format: "esm",
  external: ["express", "pino-http", "pino"],
});
const result = spawnSync(process.execPath, ["--test", ...process.argv.slice(2), "dist/planning.test.mjs"], { stdio: "inherit" });
process.exit(result.status ?? 1);
