import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import { measure } from "./measure-perf";

const positive = z.number().positive();
export const measurementSchema = z.strictObject({
  schemaVersion: z.literal(1),
  key: z
    .string()
    .regex(
      /^(linux|win32|darwin)-(x64|arm64)-(local|ci-(ubuntu-latest|windows-latest|macos-latest))-[a-f0-9]{64}$/,
    ),
  bun: z.string().regex(/\S/),
  workload: z.string().regex(/\S/),
  metrics: z.strictObject({
    versionMs: positive,
    idleRssBytes: positive,
    binaryBytes: positive,
  }),
  samples: z.strictObject({
    versionMs: z.array(positive).min(1),
    idleRssBytes: z.array(positive).min(1),
  }),
});
export const baselineSchema = z.strictObject({
  schemaVersion: z.literal(1),
  entries: z
    .array(measurementSchema.extend({ binaryLimitBytes: positive }))
    .min(1),
});

export function checkPerformance(
  baseline: unknown,
  current: unknown,
): string[] {
  const data = baselineSchema.parse(baseline);
  const sample = measurementSchema.parse(current);
  const matches = data.entries.filter(
    (entry) =>
      entry.key === sample.key &&
      entry.bun === sample.bun &&
      entry.workload === sample.workload,
  );
  if (matches.length !== 1)
    throw new Error(
      `Expected exactly one approved baseline for ${sample.key}, Bun ${sample.bun}, workload ${sample.workload}; found ${matches.length}. Supply the matching approved measurement without changing its identity.`,
    );
  const reference = matches[0];
  const failures: string[] = [];
  for (const metric of ["versionMs", "idleRssBytes", "binaryBytes"] as const) {
    const unit = metric === "versionMs" ? "milliseconds" : "bytes";
    // One ULP at the 1.2 ratio accounts for floating-point boundary rounding.
    if (
      sample.metrics[metric] / reference.metrics[metric] >
      1.2 + Number.EPSILON
    )
      failures.push(
        `${metric}: ${sample.metrics[metric]} ${unit} exceeds 120% of baseline ${reference.metrics[metric]} ${unit}.`,
      );
  }
  if (sample.metrics.binaryBytes > reference.binaryLimitBytes)
    failures.push(
      `binaryBytes: ${sample.metrics.binaryBytes} bytes exceeds the approved absolute limit of ${reference.binaryLimitBytes} bytes.`,
    );
  return failures;
}

if (import.meta.main) {
  const baselinePath = resolve("docs", "perf", "baseline.json");
  try {
    if (process.argv.length > 3)
      throw new Error("Usage: bun run perf [measurement-file.json]");
    if (!existsSync(baselinePath))
      throw new Error(
        `Approved baseline is missing at ${baselinePath}; obtain the reviewed T09 baseline before running perf.`,
      );
    const baseline = baselineSchema.parse(
      JSON.parse(readFileSync(baselinePath, "utf8")),
    );
    const artifact = resolve(
      "dist",
      process.platform === "win32" ? "agent.exe" : "agent",
    );
    const input = process.argv[2];
    const current: unknown = input
      ? JSON.parse(readFileSync(input, "utf8"))
      : measure(
          [artifact],
          artifact,
          "agent-f00-v1",
          process.env.LIZZY_PERF_RUNNER ?? "local",
        );
    const failures = checkPerformance(baseline, current);
    process.stdout.write(`${JSON.stringify({ current, failures }, null, 2)}\n`);
    if (failures.length)
      process.stderr.write(
        `${failures.join("\n")}\nInvestigate the regressions before requesting a baseline change.\n`,
      );
    process.exitCode = failures.length ? 1 : 0;
  } catch (error) {
    process.stderr.write(
      `Performance check failed: ${error instanceof Error ? error.message : "Invalid performance data."}\nCheck the approved baseline at ${baselinePath} and the native build or measurement-file input.\n`,
    );
    process.exitCode = 1;
  }
}
