import { afterEach, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { version } from "../package.json";
import type { Measurement } from "../scripts/measure-perf";
import {
  baselineSchema,
  checkPerformance,
  measurementSchema,
} from "../scripts/perf";
import { platformKey } from "../src/platform/process";

const machine = {
  host: "synthetic-host-a",
  cpuModels: ["synthetic CPU", "synthetic CPU"],
  memoryBytes: 8192,
};
const measurement: Measurement = {
  schemaVersion: 1,
  key: platformKey("local", machine),
  bun: "1.4.2",
  workload: "agent-f00-v1",
  metrics: { versionMs: 100, idleRssBytes: 100, binaryBytes: 100 },
  samples: { versionMs: [100], idleRssBytes: [100] },
};
const baseline = {
  schemaVersion: 1,
  entries: [{ ...measurement, binaryLimitBytes: 200 }],
};
const metrics = ["versionMs", "idleRssBytes", "binaryBytes"] as const;
const directories: string[] = [];
afterEach(() => {
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});
function temporary(): string {
  const directory = mkdtempSync(join(tmpdir(), "lizzy-perf-test-"));
  directories.push(directory);
  return directory;
}
function invoke(cwd: string, script: string, args: string[] = []) {
  return spawnSync(process.execPath, [script, ...args], {
    cwd,
    env: {
      ...process.env,
      HOME: cwd,
      USERPROFILE: cwd,
      LIZZY_PERF_PROBE: "1",
      LIZZY_PERF_RUNNER: "local",
    },
    encoding: "utf8",
    timeout: 10_000,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
}
function compareCli(reference: unknown, current: unknown) {
  const root = temporary();
  mkdirSync(join(root, "docs", "perf"), { recursive: true });
  writeFileSync(
    join(root, "docs", "perf", "baseline.json"),
    JSON.stringify(reference),
  );
  const input = join(root, "synthetic-measurement.json");
  writeFileSync(input, JSON.stringify(current));
  return invoke(root, resolve("scripts/perf.ts"), [input]);
}

function assembleInputs(root: string) {
  mkdirSync(join(root, "docs", "perf"), { recursive: true });
  return [
    "linux-x64-ci-ubuntu-latest-",
    "win32-x64-ci-windows-latest-",
    "darwin-arm64-ci-macos-latest-",
    "win32-x64-local-",
  ].flatMap((prefix, index) =>
    ["hello-v1", "agent-f00-v1"].map((workload) => {
      const file = join(root, `${index}-${workload}.json`);
      writeFileSync(
        file,
        JSON.stringify({
          ...measurement,
          key: prefix + "a".repeat(64),
          workload,
          metrics: { ...measurement.metrics, binaryBytes: 101 },
          samples: {
            versionMs: Array(15).fill(100),
            idleRssBytes: Array(5).fill(100),
          },
        }),
      );
      return file;
    }),
  );
}

test("assembler requires native hello/agent pairs for all three CI classes", () => {
  const root = temporary();
  const files = assembleInputs(root);
  const result = invoke(
    root,
    resolve("scripts/assemble-baseline.ts"),
    files.slice(0, 4),
  );
  expect(result.status).toBe(1);
  expect(result.stderr).toContain("six native measurement files");
  expect(() =>
    readFileSync(join(root, "docs", "perf", "baseline.json")),
  ).toThrow();
});

test("assembler preserves measurements and proposes caps from actual byte counts", () => {
  const root = temporary();
  const files = assembleInputs(root);
  const result = invoke(root, resolve("scripts/assemble-baseline.ts"), files);
  expect(result.stderr).toBe("");
  expect(result.status).toBe(0);
  const data = baselineSchema.parse(
    JSON.parse(
      readFileSync(join(root, "docs", "perf", "baseline.json"), "utf8"),
    ),
  );
  expect(data.entries).toEqual(
    files.map((file) => ({
      ...JSON.parse(readFileSync(file, "utf8")),
      binaryLimitBytes: 122,
    })),
  );
});

test.each([
  {
    name: "hardware pairing",
    change: { key: `win32-x64-ci-windows-latest-${"b".repeat(64)}` },
    diagnostic: "hello/agent pair",
  },
  { name: "Bun pairing", change: { bun: "1.4.3" }, diagnostic: "Bun 1.4.2" },
  {
    name: "workload",
    change: { workload: "other-workload" },
    diagnostic: "workload",
  },
  {
    name: "runner/OS",
    change: { key: `linux-x64-ci-windows-latest-${"a".repeat(64)}` },
    diagnostic: "native runner",
  },
  {
    name: "sample count",
    change: { samples: measurement.samples },
    diagnostic: "15 startup and 5 RSS",
  },
  {
    name: "median",
    change: { metrics: { ...measurement.metrics, versionMs: 101 } },
    diagnostic: "median",
  },
  {
    name: "invalid metric",
    change: { metrics: { ...measurement.metrics, idleRssBytes: 0 } },
    diagnostic: "too_small",
  },
])(
  "assembler rejects $name before creating a baseline",
  ({ change, diagnostic }) => {
    const root = temporary();
    const files = assembleInputs(root);
    const input = JSON.parse(readFileSync(files[3], "utf8"));
    writeFileSync(files[3], JSON.stringify({ ...input, ...change }));
    const result = invoke(root, resolve("scripts/assemble-baseline.ts"), files);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(diagnostic);
    expect(() =>
      readFileSync(join(root, "docs", "perf", "baseline.json")),
    ).toThrow();
  },
);

test("assembler rejects duplicates and incomplete local pairs", () => {
  const root = temporary();
  const files = assembleInputs(root);
  for (const [inputs, diagnostic] of [
    [[...files, files[0]], "Duplicate"],
    [files.slice(0, 7), "hello/agent pair"],
    [[...files.slice(0, 4), ...files.slice(6)], "macos-latest"],
  ] as const) {
    const result = invoke(root, resolve("scripts/assemble-baseline.ts"), [
      ...inputs,
    ]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(diagnostic);
  }
});

test("assembler refuses to overwrite an existing reviewed baseline", () => {
  const root = temporary();
  const files = assembleInputs(root);
  const path = join(root, "docs", "perf", "baseline.json");
  writeFileSync(path, "approved content");
  const result = invoke(root, resolve("scripts/assemble-baseline.ts"), files);
  expect(result.status).toBe(1);
  expect(result.stderr).toContain("already exists");
  expect(readFileSync(path, "utf8")).toBe("approved content");
});

test("assembler accepts additional complete hardware pairs without merging identities", () => {
  const root = temporary();
  const files = assembleInputs(root);
  const extra = files.slice(0, 2).map((file, index) => {
    const value = JSON.parse(readFileSync(file, "utf8"));
    value.key = value.key.replace("a".repeat(64), "b".repeat(64));
    const path = join(root, `extra-${index}.json`);
    writeFileSync(path, JSON.stringify(value));
    return path;
  });
  const result = invoke(root, resolve("scripts/assemble-baseline.ts"), [
    ...files,
    ...extra,
  ]);
  expect(result.stderr).toBe("");
  expect(result.status).toBe(0);
  expect(
    JSON.parse(
      readFileSync(join(root, "docs", "perf", "baseline.json"), "utf8"),
    ).entries,
  ).toHaveLength(10);
});

test.each(metrics)(
  "%s accepts exactly 20%% and fails above it through the CLI",
  (metric) => {
    const current = {
      ...measurement,
      metrics: { ...measurement.metrics, [metric]: 120 },
    };
    expect(checkPerformance(baseline, current)).toEqual([]);
    const pass = compareCli(baseline, current);
    expect(pass.status).toBe(0);
    expect(pass.stderr).toBe("");
    expect(JSON.parse(pass.stdout)).toEqual({ current, failures: [] });
    current.metrics[metric] = 121;
    expect(checkPerformance(baseline, current)).toHaveLength(1);
    const fail = compareCli(baseline, current);
    expect(fail.status).toBe(1);
    expect(JSON.parse(fail.stdout).failures[0]).toContain(metric);
    expect(fail.stderr).toContain(metric);
  },
);

test.each(
  metrics.flatMap((metric) =>
    [
      { referenceValue: 18, equality: 21.6, regression: 21.600001 },
      { referenceValue: 1.5, equality: 1.8, regression: 1.800001 },
    ].map((values) => ({ metric, ...values })),
  ),
)(
  "$metric fractional boundary $referenceValue -> $equality passes through the CLI",
  ({ metric, referenceValue, equality, regression }) => {
    const reference = {
      ...baseline,
      entries: [
        {
          ...measurement,
          metrics: { ...measurement.metrics, [metric]: referenceValue },
          binaryLimitBytes: Number.MAX_VALUE,
        },
      ],
    };
    const current = {
      ...measurement,
      metrics: { ...measurement.metrics, [metric]: equality },
    };
    const pass = compareCli(reference, current);
    expect(pass.status).toBe(0);
    expect(pass.stderr).toBe("");
    expect(JSON.parse(pass.stdout)).toEqual({ current, failures: [] });
    expect(checkPerformance(reference, current)).toEqual([]);
    current.metrics[metric] = regression;
    expect(checkPerformance(reference, current)).toHaveLength(1);
    const fail = compareCli(reference, current);
    expect(fail.status).toBe(1);
    expect(JSON.parse(fail.stdout).failures[0]).toContain(metric);
    expect(fail.stderr).toContain(metric);
  },
);

test.each(
  metrics.flatMap((metric) =>
    [1e308, 1e-300].map((scale) => ({ metric, scale })),
  ),
)(
  "$metric finite scale $scale retains the relative threshold",
  ({ metric, scale }) => {
    const reference = {
      ...baseline,
      entries: [
        {
          ...measurement,
          metrics: { ...measurement.metrics, [metric]: scale },
          binaryLimitBytes: Number.MAX_VALUE,
        },
      ],
    };
    const current = {
      ...measurement,
      metrics: { ...measurement.metrics, [metric]: scale * 1.2 },
    };
    expect(checkPerformance(reference, current)).toEqual([]);
    expect(compareCli(reference, current).status).toBe(0);
    current.metrics[metric] = scale * 1.3;
    expect(checkPerformance(reference, current)).toHaveLength(1);
    const result = compareCli(reference, current);
    expect(result.status).toBe(1);
    expect(JSON.parse(result.stdout).failures).toHaveLength(1);
  },
);

test("the absolute binary cap remains strict at floating-point scale", () => {
  const reference = {
    ...baseline,
    entries: [{ ...measurement, binaryLimitBytes: 21.6 }],
  };
  const current = {
    ...measurement,
    metrics: { ...measurement.metrics, binaryBytes: 21.6 },
  };
  expect(checkPerformance(reference, current)).toEqual([]);
  current.metrics.binaryBytes += Number.EPSILON * 21.6;
  expect(current.metrics.binaryBytes).toBeGreaterThan(21.6);
  expect(checkPerformance(reference, current)).toHaveLength(1);
  expect(compareCli(reference, current).status).toBe(1);
});

test("the absolute binary cap is independent of the relative threshold", () => {
  const reference = {
    ...baseline,
    entries: [{ ...measurement, binaryLimitBytes: 110 }],
  };
  expect(
    checkPerformance(reference, {
      ...measurement,
      metrics: { ...measurement.metrics, binaryBytes: 110 },
    }),
  ).toEqual([]);
  const current = {
    ...measurement,
    metrics: { ...measurement.metrics, binaryBytes: 111 },
  };
  expect(checkPerformance(reference, current)).toHaveLength(1);
  const result = compareCli(reference, current);
  expect(result.status).toBe(1);
  expect(JSON.parse(result.stdout).failures[0]).toContain("110 bytes");
});

test.each([
  0,
  -1,
  Number.NaN,
  Number.POSITIVE_INFINITY,
  Number.NEGATIVE_INFINITY,
  "100",
])("schemas and comparator reject invalid numeric data: %s", (value) => {
  for (const metric of metrics) {
    const invalid = {
      ...measurement,
      metrics: { ...measurement.metrics, [metric]: value },
    };
    expect(measurementSchema.safeParse(invalid).success).toBe(false);
    expect(() => checkPerformance(baseline, invalid)).toThrow();
    expect(() =>
      checkPerformance(
        { ...baseline, entries: [{ ...invalid, binaryLimitBytes: 200 }] },
        measurement,
      ),
    ).toThrow();
  }
  for (const metric of ["versionMs", "idleRssBytes"] as const)
    expect(
      measurementSchema.safeParse({
        ...measurement,
        samples: { ...measurement.samples, [metric]: [value] },
      }).success,
    ).toBe(false);
  expect(
    baselineSchema.safeParse({
      ...baseline,
      entries: [{ ...measurement, binaryLimitBytes: value }],
    }).success,
  ).toBe(false);
  expect(
    compareCli(baseline, {
      ...measurement,
      metrics: { ...measurement.metrics, versionMs: value },
    }).status,
  ).toBe(1);
});

test.each([
  null,
  {},
  { ...measurement, schemaVersion: 2 },
  { ...measurement, bun: "" },
  { ...measurement, workload: " " },
  { ...measurement, samples: { versionMs: [], idleRssBytes: [100] } },
  { ...measurement, extra: true },
])("malformed measurements fail validation and exit nonzero: %j", (current) => {
  expect(() => checkPerformance(baseline, current)).toThrow();
  const result = compareCli(baseline, current);
  expect(result.status).toBe(1);
  expect(result.stdout).toBe("");
  expect(result.stderr).toContain("Performance check failed");
});

test.each([
  null,
  {},
  { schemaVersion: 1, entries: [] },
  { ...baseline, entries: [...baseline.entries, ...baseline.entries] },
  { ...baseline, entries: [{ ...measurement }] },
])("missing, malformed or duplicate references never pass: %j", (reference) => {
  expect(() => checkPerformance(reference, measurement)).toThrow();
  expect(compareCli(reference, measurement).status).toBe(1);
});

test.each([
  {
    name: "host",
    change: {
      key: platformKey("local", { ...machine, host: "synthetic-host-b" }),
    },
  },
  {
    name: "CPU model",
    change: {
      key: platformKey("local", {
        ...machine,
        cpuModels: ["other synthetic CPU", "other synthetic CPU"],
      }),
    },
  },
  {
    name: "core count",
    change: {
      key: platformKey("local", { ...machine, cpuModels: ["synthetic CPU"] }),
    },
  },
  {
    name: "RAM",
    change: { key: platformKey("local", { ...machine, memoryBytes: 16384 }) },
  },
  {
    name: "runner class",
    change: { key: platformKey("windows-latest", machine) },
  },
  {
    name: "OS",
    change: {
      key: measurement.key.replace(
        /^[^-]+/,
        process.platform === "win32" ? "linux" : "win32",
      ),
    },
  },
  {
    name: "architecture",
    change: {
      key: measurement.key.replace(
        `-${process.arch}-`,
        process.arch === "x64" ? "-arm64-" : "-x64-",
      ),
    },
  },
  { name: "legacy key", change: { key: "win32-x64-local" } },
  { name: "Bun version", change: { bun: "1.4.3" } },
  { name: "workload", change: { workload: "hello-v1" } },
])("$name mismatch has no baseline fallback", ({ change }) => {
  const current = { ...measurement, ...change };
  expect(() => checkPerformance(baseline, current)).toThrow();
  expect(compareCli(baseline, current).status).toBe(1);
});

test("selects the exact workload and rejects invalid reference keys", () => {
  const mixed = {
    ...baseline,
    entries: [
      { ...measurement, workload: "hello-v1", binaryLimitBytes: 200 },
      ...baseline.entries,
    ],
  };
  expect(checkPerformance(mixed, measurement)).toEqual([]);
  expect(() =>
    checkPerformance(
      {
        ...baseline,
        entries: [{ ...baseline.entries[0], key: "win32-x64-local" }],
      },
      measurement,
    ),
  ).toThrow();
});

test("CLI fails early on a missing approved baseline and rejects unreadable or malformed input", () => {
  const root = temporary();
  const missing = invoke(root, resolve("scripts/perf.ts"));
  expect(missing.status).toBe(1);
  expect(missing.stdout).toBe("");
  expect(missing.stderr).toContain("baseline.json");
  expect(missing.stderr).not.toContain("agent.exe");
  mkdirSync(join(root, "docs", "perf"), { recursive: true });
  const reference = join(root, "docs", "perf", "baseline.json");
  writeFileSync(reference, JSON.stringify(baseline));
  const input = join(root, "invalid.json");
  const extra = invoke(root, resolve("scripts/perf.ts"), [input, input]);
  expect(extra.status).toBe(1);
  expect(extra.stderr).toContain("Usage:");
  for (const contents of [
    undefined,
    "not JSON",
    '{"metrics":{"versionMs":1e400}}',
  ]) {
    if (contents !== undefined) writeFileSync(input, contents);
    expect(invoke(root, resolve("scripts/perf.ts"), [input]).status).toBe(1);
  }
  expect(invoke(root, resolve("scripts/perf.ts")).status).toBe(1);
  writeFileSync(reference, "not JSON");
  expect(invoke(root, resolve("scripts/perf.ts"), [input]).status).toBe(1);
});

test("the probe reports this initialized child after config, shell and 200 ms", () => {
  const root = temporary();
  const preload = join(root, "observe-initialization.ts");
  const trace = join(root, "trace.jsonl");
  const configUrl = pathToFileURL(resolve("src/platform/config.ts")).href;
  const shellUrl = pathToFileURL(resolve("src/platform/shell.ts")).href;
  writeFileSync(
    preload,
    `
    import { mock } from "bun:test";
    import { appendFileSync } from "node:fs";
    const { loadConfig } = await import(${JSON.stringify(configUrl)});
    const { resolveShell } = await import(${JSON.stringify(shellUrl)});
    const record = value => appendFileSync(${JSON.stringify(trace)}, JSON.stringify(value) + "\\n");
    let initialized;
    mock.module(${JSON.stringify(configUrl)}, () => ({ loadConfig: async () => { const config = await loadConfig(); record("config"); return config; } }));
    mock.module(${JSON.stringify(shellUrl)}, () => ({ resolveShell: configured => { const shell = resolveShell(configured); record("shell"); initialized = performance.now(); return shell; } }));
    const memoryUsage = process.memoryUsage;
    process.memoryUsage = () => { const value = memoryUsage(); record({ pid: process.pid, rss: value.rss, waitedMs: performance.now() - initialized }); return value; };
  `,
  );
  const child = invoke(root, resolve("src/cli.ts"), []);
  expect(child.status).toBe(0);
  expect(child.stderr).toBe("");
  expect(JSON.parse(child.stdout).rss).toBeGreaterThan(0);
  const observed = invoke(root, "--preload", [preload, resolve("src/cli.ts")]);
  expect(observed.status).toBe(0);
  expect(observed.stderr).toBe("");
  const records = readFileSync(trace, "utf8")
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  expect(records.slice(0, 2)).toEqual(["config", "shell"]);
  expect(records[2].pid).toBe(observed.pid);
  expect(records[2].pid).not.toBe(process.pid);
  expect(records[2].rss).toBe(JSON.parse(observed.stdout).rss);
  expect(records[2].waitedMs).toBeGreaterThanOrEqual(200);
});

test.each(["config", "shell"])(
  "failed %s initialization produces no successful RSS evidence",
  (failure) => {
    const root = temporary();
    mkdirSync(join(root, ".lizzy"));
    writeFileSync(
      join(root, ".lizzy", "config.jsonc"),
      failure === "config"
        ? "not JSON"
        : JSON.stringify({
            shell: { bash: join(root, "missing", "bash.exe") },
          }),
    );
    const child = invoke(root, resolve("src/cli.ts"));
    expect(child.status).toBe(1);
    expect(child.stdout).toBe("");
    expect(child.stderr).toContain(
      failure === "config" ? "JSONC" : "shell.bash",
    );
    const measureScript = join(root, "measure-invalid.ts");
    writeFileSync(
      measureScript,
      `import { measure } from ${JSON.stringify(pathToFileURL(resolve("scripts/measure-perf.ts")).href)}; process.stdout.write(JSON.stringify(measure([process.execPath, ${JSON.stringify(resolve("src/cli.ts"))}], ${JSON.stringify(resolve("src/cli.ts"))}, "initialized-source-test", "local")));`,
    );
    const measured = invoke(root, measureScript);
    expect(measured.status).toBe(1);
    expect(measured.stdout).toBe("");
    expect(measured.stderr).toContain(
      failure === "config" ? "JSONC" : "shell.bash",
    );
    for (const flag of ["--help", "-h", "--version", "-v"]) {
      const info = invoke(root, resolve("src/cli.ts"), [flag]);
      expect(info.status).toBe(0);
      expect(info.stderr).toBe("");
      if (flag.includes("h")) expect(info.stdout).toContain("Usage: agent");
      else expect(info.stdout).toBe(`${version}\n`);
    }
  },
);

test.each([undefined, "0", "true"])(
  "disabled probe (%s) returns false without output",
  (probe) => {
    const root = temporary();
    const script = join(root, "disabled.ts");
    writeFileSync(
      script,
      `import { reportIdleProbe } from ${JSON.stringify(pathToFileURL(resolve("src/platform/process.ts")).href)}; process.stderr.write(String(await reportIdleProbe()));`,
    );
    const result = spawnSync(process.execPath, [script], {
      cwd: root,
      env: { ...process.env, LIZZY_PERF_PROBE: probe },
      encoding: "utf8",
      timeout: 10_000,
      windowsHide: true,
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe("false");
  },
);
