import { artifactBytes, platformKey, run } from "../src/platform/process";

export type Metrics = {
  versionMs: number;
  idleRssBytes: number;
  binaryBytes: number;
};
export type Measurement = {
  schemaVersion: 1;
  key: string;
  bun: string;
  workload: string;
  metrics: Metrics;
  samples: { versionMs: number[]; idleRssBytes: number[] };
};
const median = (values: number[]): number =>
  [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

export function measure(
  command: string[],
  artifact: string,
  workload: string,
  runner: string,
): Measurement {
  if (!workload.trim()) throw new Error("A performance workload is required.");
  const key = platformKey(runner);
  const binaryBytes = artifactBytes(artifact);
  const env = { ...process.env, LIZZY_PERF_PROBE: "0" };
  for (let i = 0; i < 3; i++) run([...command, "--version"], env);
  const versionMs = Array.from({ length: 15 }, () => {
    const start = performance.now();
    run([...command, "--version"], env);
    return performance.now() - start;
  });
  const idleRssBytes = Array.from({ length: 5 }, () => {
    const value: unknown = JSON.parse(
      run(command, { ...env, LIZZY_PERF_PROBE: "1" }),
    );
    if (
      !value ||
      typeof value !== "object" ||
      !("rss" in value) ||
      typeof value.rss !== "number" ||
      !Number.isFinite(value.rss) ||
      value.rss <= 0
    ) {
      throw new Error("Child probe must return positive RSS in bytes.");
    }
    return value.rss;
  });
  return {
    schemaVersion: 1,
    key,
    bun: Bun.version,
    workload,
    metrics: {
      versionMs: median(versionMs),
      idleRssBytes: median(idleRssBytes),
      binaryBytes,
    },
    samples: { versionMs, idleRssBytes },
  };
}

if (import.meta.main) {
  const [artifact, workload] = process.argv.slice(2);
  if (!artifact || !workload)
    throw new Error("Usage: measure-perf.ts <binary> <workload>");
  const result = measure(
    [artifact],
    artifact,
    workload,
    process.env.LIZZY_PERF_RUNNER ?? "local",
  );
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
