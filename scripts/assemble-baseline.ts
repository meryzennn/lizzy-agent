import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { engines } from "../package.json";
import { baselineSchema, measurementSchema } from "./perf";

const path = resolve("docs", "perf", "baseline.json");
try {
  const inputs = process.argv.slice(2);
  if (inputs.length < 6)
    throw new Error(
      "Supply at least six native measurement files: hello and agent for Linux, Windows and macOS.",
    );
  if (existsSync(path))
    throw new Error(
      "Baseline already exists; updates require measured evidence and a spec-change review.",
    );
  const prefixes = [
    "linux-x64-ci-ubuntu-latest-",
    "win32-x64-ci-windows-latest-",
    "darwin-arm64-ci-macos-latest-",
    "win32-x64-local-",
  ];
  const identities = new Set<string>();
  const entries = inputs.map((file) => {
    const measured = measurementSchema.parse(
      JSON.parse(readFileSync(file, "utf8")),
    );
    if (measured.bun !== engines.bun)
      throw new Error(`${file}: expected Bun ${engines.bun}.`);
    if (!["hello-v1", "agent-f00-v1"].includes(measured.workload))
      throw new Error(`${file}: unexpected workload ${measured.workload}.`);
    if (!prefixes.some((prefix) => measured.key.startsWith(prefix)))
      throw new Error(
        `${file}: unsupported native runner/OS/architecture identity.`,
      );
    const identity = `${measured.key}/${measured.bun}/${measured.workload}`;
    if (identities.has(identity))
      throw new Error(`Duplicate measurement: ${identity}.`);
    identities.add(identity);
    if (
      measured.samples.versionMs.length !== 15 ||
      measured.samples.idleRssBytes.length !== 5
    )
      throw new Error(`${file}: expected 15 startup and 5 RSS samples.`);
    for (const metric of ["versionMs", "idleRssBytes"] as const) {
      const samples = [...measured.samples[metric]].sort((a, b) => a - b);
      if (measured.metrics[metric] !== samples[Math.floor(samples.length / 2)])
        throw new Error(
          `${file}: ${metric} does not match the retained sample median.`,
        );
    }
    if (
      ![measured.metrics.binaryBytes, ...measured.samples.idleRssBytes].every(
        Number.isSafeInteger,
      )
    )
      throw new Error(`${file}: byte counts must be positive safe integers.`);
    return {
      ...measured,
      binaryLimitBytes: Math.ceil(measured.metrics.binaryBytes * 1.2),
    };
  });
  for (const prefix of prefixes.slice(0, 3)) {
    if (!entries.some((entry) => entry.key.startsWith(prefix)))
      throw new Error(`Missing native measurements for ${prefix}.`);
  }
  for (const entry of entries) {
    const pair = entries.filter(
      (other) => other.key === entry.key && other.bun === entry.bun,
    );
    if (pair.length !== 2)
      throw new Error(
        `${entry.key}: require a complete hello/agent pair with identical key and Bun.`,
      );
  }
  const baseline = baselineSchema.parse({ schemaVersion: 1, entries });
  writeFileSync(path, `${JSON.stringify(baseline, null, 2)}\n`, { flag: "wx" });
  process.stdout.write(
    `Created ${path} from ${entries.length} measured records; caps are proposals pending spec-change review.\n`,
  );
} catch (error) {
  process.stderr.write(
    `Baseline assembly failed: ${error instanceof Error ? error.message : "Invalid input."}\n`,
  );
  process.exitCode = 1;
}
