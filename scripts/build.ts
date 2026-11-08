import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { run } from "../src/platform/process";

mkdirSync("dist", { recursive: true });
const output = resolve(
  "dist",
  process.platform === "win32" ? "agent.exe" : "agent",
);
run(
  [process.execPath, "build", "--compile", "src/cli.ts", "--outfile", output],
  process.env,
  120_000,
);
process.stdout.write(`${output}\n`);
