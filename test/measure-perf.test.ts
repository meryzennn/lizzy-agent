import { afterEach, expect, test } from "bun:test";
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { measure } from "../scripts/measure-perf";
import { artifactBytes, platformKey, run } from "../src/platform/process";

const directories: string[] = [];
afterEach(() => {
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true });
});

function fixture(source: string): string {
  const directory = mkdtempSync(join(tmpdir(), "lizzy perf "));
  directories.push(directory);
  const path = join(directory, "probe.ts");
  writeFileSync(path, source);
  return path;
}

test("run preserves argv and environment without shell interpolation", () => {
  const path = fixture(
    "process.stdout.write(JSON.stringify([process.argv.slice(2), process.env.LIZZY_TEST_VALUE]));",
  );
  const args = ["space here", "$(echo unexpected)", "a&b", 'a"b'];
  expect(
    JSON.parse(
      run([process.execPath, path, ...args], {
        ...process.env,
        LIZZY_TEST_VALUE: "fixture",
      }),
    ),
  ).toEqual([args, "fixture"]);
});

test("run rejects a failed child, missing executable, and timeout", () => {
  const failed = fixture(
    'process.stderr.write("fixture failure"); process.exit(7);',
  );
  expect(() => run([process.execPath, failed])).toThrow("fixture failure");
  expect(() => run([join(directories[0], "missing-executable")])).toThrow();
  const sleeping = fixture("await Bun.sleep(30_000); export {};");
  const start = performance.now();
  expect(() => run([process.execPath, sleeping], process.env, 100)).toThrow();
  expect(performance.now() - start).toBeLessThan(5_000);
});

test("run rejects an empty command and disabled or invalid timeouts", () => {
  expect(() => run([])).toThrow();
  for (const timeout of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    expect(() =>
      run([process.execPath, "--version"], process.env, timeout),
    ).toThrow();
  }
});

test("machine keys separate local hosts and CI hardware without publishing hostnames", () => {
  const machine = {
    host: "fixture-host-a",
    cpuModels: ["CPU B", "CPU A"],
    memoryBytes: 8192,
  };
  const key = platformKey("local", machine);
  expect(key).toMatch(
    new RegExp(`^${process.platform}-${process.arch}-local-[a-f0-9]{64}$`),
  );
  expect(key).toBe(
    platformKey("local", { ...machine, cpuModels: [" CPU A ", "CPU B"] }),
  );
  expect(key).not.toContain(machine.host);
  expect(platformKey("local", { ...machine, host: "fixture-host-b" })).not.toBe(
    key,
  );
  const ciKey = platformKey("windows-latest", machine);
  expect(ciKey).toContain("-ci-windows-latest-");
  expect(ciKey).toBe(
    platformKey("windows-latest", { ...machine, host: "ephemeral-runner-b" }),
  );
  expect(ciKey).not.toBe(key);
  expect(ciKey).not.toBe(platformKey("ubuntu-latest", machine));
  for (const other of [
    { ...machine, cpuModels: ["CPU C", "CPU A"] },
    { ...machine, cpuModels: ["CPU A"] },
    { ...machine, memoryBytes: 16384 },
  ]) {
    expect(platformKey("local", other)).not.toBe(key);
    expect(platformKey("windows-latest", other)).not.toBe(ciKey);
  }
});

test("machine keys reject unsupported runners and incomplete identities", () => {
  const machine = {
    host: "fixture-host",
    cpuModels: ["CPU A"],
    memoryBytes: 8192,
  };
  expect(() => platformKey("unknown", machine)).toThrow();
  for (const other of [
    { ...machine, host: " " },
    { ...machine, cpuModels: [] },
    { ...machine, cpuModels: [" "] },
    { ...machine, memoryBytes: 0 },
    { ...machine, memoryBytes: Number.NaN },
    { ...machine, memoryBytes: Number.POSITIVE_INFINITY },
  ])
    expect(() => platformKey("local", other)).toThrow();
});

test("measure warms three children, retains fifteen startup and five child RSS samples", () => {
  const path = fixture(`
    import { appendFileSync } from "node:fs";
    const version = process.argv.includes("--version");
    appendFileSync(import.meta.filename + ".log", JSON.stringify({ pid: process.pid, version, probe: process.env.LIZZY_PERF_PROBE }) + "\\n");
    process.stdout.write(version ? "fixture 0\\n" : '{"rss":12345}\\n');
  `);
  const result = measure(
    [process.execPath, path],
    path,
    "fixture-source-test",
    "local",
  );
  expect(result).toMatchObject({
    schemaVersion: 1,
    key: platformKey("local"),
    bun: Bun.version,
    workload: "fixture-source-test",
  });
  expect(result.samples.versionMs).toHaveLength(15);
  expect(
    result.samples.versionMs.every(
      (value) => Number.isFinite(value) && value > 0,
    ),
  ).toBe(true);
  expect(result.metrics.versionMs).toBe(
    [...result.samples.versionMs].sort((a, b) => a - b)[7],
  );
  expect(result.samples.idleRssBytes).toEqual(Array(5).fill(12345));
  expect(result.metrics.idleRssBytes).toBe(12345);
  expect(result.metrics.binaryBytes).toBe(statSync(path).size);
  const children = readFileSync(`${path}.log`, "utf8")
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  expect(children).toHaveLength(23);
  expect(children.every((child) => child.pid !== process.pid)).toBe(true);
  expect(
    children
      .slice(0, 18)
      .every((child) => child.version && child.probe === "0"),
  ).toBe(true);
  expect(
    children.slice(18).every((child) => !child.version && child.probe === "1"),
  ).toBe(true);
});

test("hello source probe measures real child RSS (not native binary evidence)", () => {
  const path = resolve("spikes/boot.ts");
  const result = measure(
    [process.execPath, path],
    path,
    "hello-source-test",
    "local",
  );
  expect(result.samples.idleRssBytes).toHaveLength(5);
  expect(
    result.samples.idleRssBytes.every((rss) => Number.isFinite(rss) && rss > 0),
  ).toBe(true);
  expect(result.metrics.idleRssBytes).toBe(
    [...result.samples.idleRssBytes].sort((a, b) => a - b)[2],
  );
  expect(artifactBytes(path)).toBe(statSync(path).size);
});

test.each(["null", '{"rss":0}', '{"rss":"123"}', '{"rss":1e400}', "not JSON"])(
  "measure rejects invalid child RSS: %s",
  (output) => {
    const path = fixture(
      `if (!process.argv.includes("--version")) process.stdout.write(${JSON.stringify(output)});`,
    );
    expect(() =>
      measure([process.execPath, path], path, "invalid-probe-test", "local"),
    ).toThrow();
  },
);

test("measure propagates process/artifact failures and rejects an empty workload", () => {
  const path = fixture("process.exit(9);");
  expect(() =>
    measure([process.execPath, path], path, "failed-child-test", "local"),
  ).toThrow();
  expect(() => artifactBytes(`${path}.missing`)).toThrow();
  expect(() => measure([process.execPath, path], path, " ", "local")).toThrow(
    "workload",
  );
});
