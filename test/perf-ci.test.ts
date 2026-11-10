import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parsePolicy, policyRevision, prepareCI } from "../scripts/perf-ci";
import { platformKey } from "../src/platform/process";

const policy = {
  schemaVersion: 1 as const,
  repository: "meryzennn/lizzy-agent",
  referenceCommit: "61d868f200f4c9e99a54388603ef0c6098a255c1",
  bun: "1.4.2",
  workload: "agent-f00-v1",
  binaryLimitBytes: { "linux-x64": 97784794, "win32-x64": 103514727 },
};
const revision = "a".repeat(40);
const event = {
  repository: { full_name: policy.repository },
  ref: "refs/heads/main",
  before: revision,
  pull_request: {
    base: { sha: revision, repo: { full_name: policy.repository } },
  },
};

test("policy selection uses the base repository and immutable pre-candidate revision", () => {
  expect(policyRevision("pull_request", event)).toBe(revision);
  expect(policyRevision("push", event)).toBe(revision);
  for (const before of [undefined, "0".repeat(40), "main", "a".repeat(39)])
    expect(() => policyRevision("push", { ...event, before })).toThrow();
  expect(() => policyRevision("workflow_dispatch", event)).toThrow();
  expect(() =>
    policyRevision("push", { ...event, ref: "refs/heads/other" }),
  ).toThrow();
  expect(() =>
    policyRevision("pull_request", {
      ...event,
      pull_request: {
        base: { sha: revision, repo: { full_name: "attacker/fork" } },
      },
    }),
  ).toThrow();
});

test("policy is strict, immutable, and requires both independent native caps", () => {
  expect(parsePolicy(policy)).toEqual(policy);
  for (const change of [
    { referenceCommit: "main" },
    { referenceCommit: "0".repeat(40) },
    { repository: "attacker/fork" },
    { bun: "latest" },
    { workload: "hello-v1" },
    { extra: true },
    { binaryLimitBytes: { "linux-x64": 100 } },
    { binaryLimitBytes: { "linux-x64,win32-x64": 100 } },
    { binaryLimitBytes: { ...policy.binaryLimitBytes, "win32-x64": 0 } },
  ])
    expect(() => parsePolicy({ ...policy, ...change })).toThrow();
});

const root = mkdtempSync(join(tmpdir(), "lizzy paired fixture with spaces "));
const source = join(root, "trusted repository");
const candidate = join(root, "candidate checkout");
const entrypoint = pathToFileURL(resolve("scripts/perf-ci.ts")).href;
let policyCommit: string;
let referenceCommit: string;
let candidateCommit: string;
function command(argv: string[], cwd: string) {
  const result = spawnSync(argv[0], argv.slice(1), {
    cwd,
    encoding: "utf8",
    timeout: 30_000,
    windowsHide: true,
  });
  if (result.error || result.status !== 0)
    throw new Error(`${argv.join(" ")}: ${result.error ?? result.stderr}`);
  return result.stdout.trim();
}
function commit(directory: string) {
  command(["git", "add", "."], directory);
  command(
    [
      "git",
      "-c",
      "user.name=Fixture",
      "-c",
      "user.email=fixture@example.invalid",
      "commit",
      "--allow-empty",
      "-m",
      "fixture",
    ],
    directory,
  );
  return command(["git", "rev-parse", "HEAD"], directory);
}
function writeJson(path: string, value: unknown) {
  writeFileSync(path, JSON.stringify(value));
}
const nativePrefix = `${process.platform}-${process.arch}-local-`;
const fixtureInput = {
  key: nativePrefix + "e".repeat(64),
  versionMs: 100,
  idleRssBytes: 100,
  bytes: 1000,
};
beforeAll(() => {
  // Keep the real validator, but avoid copying 840 dependency files for every fixture pair.
  const trustedDependency = join(source, "fixture-zod");
  mkdirSync(trustedDependency, { recursive: true });
  writeJson(join(trustedDependency, "package.json"), {
    name: "zod",
    version: "0.0.0",
    type: "module",
    main: "index.js",
  });
  command(
    [
      process.execPath,
      "build",
      resolve("node_modules/zod/index.js"),
      "--target",
      "bun",
      "--outfile",
      join(trustedDependency, "index.js"),
    ],
    root,
  );
  for (const path of ["scripts", "src/platform", "docs/perf"])
    mkdirSync(join(source, path), { recursive: true });
  writeFileSync(join(source, ".gitignore"), "node_modules/\ndist/\n");
  writeFileSync(join(source, ".bun-version"), Bun.version);
  writeJson(join(source, "package.json"), {
    name: "paired-fixture",
    type: "module",
    engines: { bun: Bun.version },
    scripts: { build: "bun scripts/build.ts" },
    dependencies: {
      zod: "file:./fixture-zod",
    },
  });
  cpSync(resolve("scripts/perf.ts"), join(source, "scripts/perf.ts"));
  cpSync(
    resolve("src/platform/process.ts"),
    join(source, "src/platform/process.ts"),
  );
  writeFileSync(
    join(source, "scripts/build.ts"),
    `
    import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
    import { resolve } from "node:path";
    const input = JSON.parse(readFileSync("input.json", "utf8"));
    if (input.buildError) throw new Error("fixture build failed");
    mkdirSync("dist", { recursive: true });
    const binary = resolve("dist", process.platform === "win32" ? "agent.exe" : "agent");
    if (!input.missingBinary) writeFileSync(binary, JSON.stringify(input).padEnd(input.bytes));
    appendFileSync(process.env.CI_TEST_TRACE, JSON.stringify({ stage: "build", binary }) + "\\n");
  `,
  );
  writeFileSync(
    join(source, "scripts/measure-perf.ts"),
    `
    import { appendFileSync, existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
    import { homedir } from "node:os";
    import { join } from "node:path";
    import { run } from "../src/platform/process";
    export function measure(command, artifact, workload, runner) {
      if (command.length !== 1 || command[0] !== artifact) throw new Error("wrong binary command");
      if (readdirSync(process.cwd()).length || readdirSync(homedir()).length) throw new Error("runtime contamination");
      if (existsSync(join(process.cwd(), ".lizzy/config.jsonc"))) throw new Error("project config leaked");
      const input = JSON.parse(readFileSync(artifact, "utf8"));
      appendFileSync(process.env.CI_TEST_TRACE, JSON.stringify({ stage: "measure", artifact, cwd: process.cwd(), home: homedir(), path: process.env.PATH, localAppData: process.env.LOCALAPPDATA }) + "\\n");
      writeFileSync(join(homedir(), "reference-sentinel"), "must not reach next role");
      if (input.probeError) {
        if (input.probeError === "exit") run([process.execPath, "-e", "process.stderr.write('probe exited'); process.exit(3)"]);
        if (input.probeError === "timeout") run([process.execPath, "-e", "setInterval(() => {}, 1000)"], process.env, 10);
        throw new Error("Child probe must return positive RSS in bytes.");
      }
      return { schemaVersion: 1, key: input.key, bun: input.bun ?? Bun.version, workload: input.workload ?? workload,
        metrics: { versionMs: input.versionMs, idleRssBytes: input.idleRssBytes, binaryBytes: statSync(artifact).size },
        samples: { versionMs: Array(input.startupCount ?? 15).fill(input.versionMs), idleRssBytes: Array(input.rssCount ?? 5).fill(input.idleRssBytes) } };
    }
  `,
  );
  writeJson(join(source, "input.json"), fixtureInput);
  command([process.execPath, "install", "--lockfile-only"], source);
  command(["git", "init"], source);
  referenceCommit = commit(source);
  writeJson(join(source, "docs/perf/ci-reference.json"), {
    ...policy,
    referenceCommit,
    bun: Bun.version,
  });
  policyCommit = commit(source);
  command(["git", "clone", source, candidate], root);
  writeJson(join(candidate, "input.json"), { ...fixtureInput, bytes: 1100 });
  const poisonedDependency = join(root, "candidate-only-zod");
  mkdirSync(poisonedDependency);
  writeJson(join(poisonedDependency, "package.json"), {
    name: "zod",
    version: "0.0.0",
    main: "index.js",
  });
  writeFileSync(
    join(poisonedDependency, "index.js"),
    "throw new Error('candidate dependency must never supply the harness');",
  );
  const candidatePackage = JSON.parse(
    readFileSync(join(candidate, "package.json"), "utf8"),
  );
  candidatePackage.dependencies.zod = `file:${poisonedDependency.replaceAll("\\", "/")}`;
  writeJson(join(candidate, "package.json"), candidatePackage);
  command([process.execPath, "install", "--lockfile-only"], candidate);
  for (const file of [
    "scripts/perf.ts",
    "scripts/measure-perf.ts",
    "src/platform/process.ts",
  ])
    writeFileSync(
      join(candidate, file),
      "throw new Error('candidate harness must never load');",
    );
  writeJson(join(candidate, "docs/perf/ci-reference.json"), {
    ...policy,
    bun: "9.9.9",
    referenceCommit: "f".repeat(40),
    binaryLimitBytes: { "linux-x64": 1, "win32-x64": 1 },
  });
  writeFileSync(
    join(candidate, "docs/perf/baseline.json"),
    "poisoned candidate historical baseline",
  );
  mkdirSync(join(candidate, ".lizzy"));
  writeFileSync(
    join(candidate, ".lizzy/config.jsonc"),
    "invalid configuration",
  );
  candidateCommit = commit(candidate);
}, 30_000);
afterAll(() => {
  rmSync(root, { recursive: true, force: true });
}, 120_000);

async function prepare(policyChange?: Record<string, unknown>) {
  const evidence = mkdtempSync(join(root, "evidence "));
  const eventPath = join(evidence, "event.json");
  let before = policyCommit;
  if (policyChange) {
    writeJson(join(source, "docs/perf/ci-reference.json"), {
      ...policy,
      referenceCommit,
      bun: Bun.version,
      ...policyChange,
    });
    before = commit(source);
  }
  writeJson(eventPath, { ...event, before });
  await prepareCI({
    evidence,
    candidate,
    candidateRevision: candidateCommit,
    eventName: "push",
    eventPath,
    runner: "local",
    policySource: source,
  });
  return evidence;
}
function runPair(evidence: string) {
  const script = join(evidence, "invoke.ts");
  const originalHome = join(evidence, "poisoned inherited home");
  mkdirSync(join(originalHome, ".lizzy"), { recursive: true });
  writeFileSync(
    join(originalHome, ".lizzy/config.jsonc"),
    "invalid global config",
  );
  writeFileSync(
    script,
    `
    import assert from "node:assert/strict";
    import { measurePair } from ${JSON.stringify(entrypoint)};
    const cwd = process.cwd(), env = { ...process.env };
    try { await measurePair(${JSON.stringify(evidence)}); }
    catch (error) { console.error(error); process.exitCode = 1; }
    finally { assert.equal(process.cwd(), cwd); assert.deepEqual({ ...process.env }, env); }
  `,
  );
  const result = spawnSync(process.execPath, [script], {
    cwd: root,
    env: {
      ...process.env,
      HOME: originalHome,
      USERPROFILE: originalHome,
      CI_TEST_TRACE: join(evidence, "trace.jsonl"),
    },
    encoding: "utf8",
    timeout: 30_000,
    windowsHide: true,
  });
  expect(result.error).toBeUndefined();
  return {
    result,
    report: JSON.parse(
      readFileSync(join(evidence, "perf-result.json"), "utf8"),
    ),
  };
}
function changeInput(directory: string, change: Record<string, unknown>) {
  writeJson(join(directory, "input.json"), { ...fixtureInput, ...change });
}

test("actual entrypoint builds distinct artifacts before a matching unseen pair, ignoring candidate policy and harness", async () => {
  const evidence = await prepare();
  const { result, report } = runPair(evidence);
  if (result.status !== 0) throw new Error(result.stderr);
  expect(result.status).toBe(0);
  expect(report.failures).toEqual([]);
  expect(report.context.policy.referenceCommit).toBe(referenceCommit);
  expect(report.context.policyRevision).toBe(policyCommit);
  expect(report.context.policySha256).toMatch(/^[a-f0-9]{64}$/);
  expect(report.measurements.reference.metrics.binaryBytes).toBe(1000);
  expect(report.measurements.candidate.metrics.binaryBytes).toBe(1100);
  expect(report.artifacts.candidate.installedDependencySha256).not.toBe(
    report.artifacts.reference.installedDependencySha256,
  );
  const trace = readFileSync(join(evidence, "trace.jsonl"), "utf8")
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  expect(trace.map((value) => value.stage)).toEqual([
    "build",
    "build",
    "measure",
    "measure",
  ]);
  expect(trace[2].artifact).toBe(trace[0].binary);
  expect(trace[3].artifact).toBe(trace[1].binary);
  expect(trace[2].artifact).not.toBe(trace[3].artifact);
  expect(trace[2].home).not.toBe(trace[3].home);
  expect(trace[2].cwd).not.toBe(trace[3].cwd);
  expect(trace[2].path).toBe(trace[3].path);
  expect(trace[2].localAppData).toBe(trace[3].localAppData);
  for (const role of ["reference", "candidate"]) {
    expect(report.artifacts[role].installedDependencySha256).toMatch(
      /^[a-f0-9]{64}$/,
    );
    expect(report.artifacts[role].runtime.initiallyEmpty).toBe(true);
    expect(
      report.stages
        .find(
          (stage: { role: string; stage: string }) =>
            stage.role === role && stage.stage === "install",
        )
        .argv.slice(1),
    ).toEqual(["install", "--frozen-lockfile"]);
  }
}, 30_000);

test.each(["versionMs", "idleRssBytes", "bytes"])(
  "paired entrypoint accepts 20%% and rejects 21%% for %s",
  async (metric) => {
    for (const percent of [20, 21]) {
      const evidence = await prepare();
      changeInput(candidate, {
        [metric]:
          metric === "bytes" ? 1000 * (1 + percent / 100) : 100 + percent,
      });
      const { result, report } = runPair(evidence);
      expect(result.status).toBe(percent === 20 ? 0 : 1);
      expect(report.failures).toHaveLength(percent === 20 ? 0 : 1);
      expect(report.measurements.reference.samples.versionMs).toHaveLength(15);
      expect(report.measurements.candidate.samples.idleRssBytes).toHaveLength(
        5,
      );
    }
    changeInput(candidate, { bytes: 1100 });
  },
  30_000,
);

test.each([
  ["build", { buildError: true }],
  ["binary", { missingBinary: true }],
  ["measure", { probeError: "exit" }],
  ["measure", { probeError: "timeout" }],
  ["measure", { probeError: "malformed" }],
  ["measurement-validation", { startupCount: 14 }],
  ["measurement-validation", { rssCount: 4 }],
  ["measurement-validation", { bun: "9.9.9" }],
  ["measurement-validation", { workload: "hello-v1" }],
  ["comparison", { key: nativePrefix + "b".repeat(64) }],
  ["measurement-validation", { key: `darwin-arm64-local-${"e".repeat(64)}` }],
] as const)(
  "retains candidate %s failures and every completed result (%j)",
  async (stage, change) => {
    const evidence = await prepare();
    changeInput(candidate, change);
    // Each attempt needs a fresh build output, including the missing-artifact case.
    rmSync(join(candidate, "dist"), { recursive: true, force: true });
    const { result, report } = runPair(evidence);
    expect(result.status).toBe(1);
    expect(
      report.stages.find(
        (value: { outcome: string }) => value.outcome === "failed",
      ),
    ).toMatchObject({
      stage,
      role: stage === "comparison" ? "pair" : "candidate",
    });
    if (["measure", "measurement-validation", "comparison"].includes(stage))
      expect(report.measurements.reference.samples.versionMs).toHaveLength(15);
    if (stage === "measure")
      expect(report.artifacts.candidate.incompleteSamples).toContain(
        "Unavailable",
      );
    changeInput(candidate, { bytes: 1100 });
  },
  30_000,
);

test("fixed trusted cap accepts equality and fails cap+1 independently of relative size", async () => {
  for (const bytes of [1100, 1101]) {
    const evidence = await prepare({
      binaryLimitBytes: { "linux-x64": 1100, "win32-x64": 1100 },
    });
    changeInput(candidate, { bytes });
    const { result, report } = runPair(evidence);
    expect(result.status).toBe(bytes === 1100 ? 0 : 1);
    expect(report.failures).toHaveLength(bytes === 1100 ? 0 : 1);
    if (bytes === 1101)
      expect(report.failures[0]).toContain("absolute limit of 1100");
  }
  changeInput(candidate, { bytes: 1100 });
}, 60_000);

test.each(["reference", "candidate"] as const)(
  "retains %s install and build/probe failures",
  async (role) => {
    for (const stage of ["install", "build", "measure"]) {
      const evidence = await prepare();
      const checkout =
        role === "reference" ? join(evidence, "reference") : candidate;
      const lock = readFileSync(join(checkout, "bun.lock"));
      if (stage === "install")
        writeFileSync(join(checkout, "bun.lock"), "malformed lockfile");
      else
        changeInput(
          checkout,
          stage === "build" ? { buildError: true } : { probeError: "exit" },
        );
      const { result, report } = runPair(evidence);
      expect(result.status).toBe(1);
      expect(
        report.stages.find(
          (value: { outcome: string }) => value.outcome === "failed",
        ),
      ).toMatchObject({ stage, role });
      expect(report.error.length).toBeGreaterThan(0);
      if (stage === "install")
        expect(report.stages.at(-1).argv.slice(1)).toEqual([
          "install",
          "--frozen-lockfile",
        ]);
      if (role === "reference") expect(report.measurements).toEqual({});
      writeFileSync(join(checkout, "bun.lock"), lock);
      changeInput(checkout, { bytes: role === "candidate" ? 1100 : 1000 });
    }
  },
  60_000,
);

test("candidate toolchain poisoning fails before building", async () => {
  const evidence = await prepare();
  writeFileSync(join(candidate, ".bun-version"), "9.9.9");
  const { result, report } = runPair(evidence);
  expect(result.status).toBe(1);
  expect(report.error).toContain("Build input Bun pin");
  expect(
    report.stages.some((stage: { stage: string }) => stage.stage === "build"),
  ).toBe(false);
  writeFileSync(join(candidate, ".bun-version"), Bun.version);
}, 30_000);

test("even agreeing measurements must match policy Bun and workload", async () => {
  for (const change of [{ bun: "9.9.9" }, { workload: "hello-v1" }]) {
    const evidence = await prepare();
    changeInput(join(evidence, "reference"), change);
    changeInput(candidate, change);
    const { result, report } = runPair(evidence);
    expect(result.status).toBe(1);
    expect(report.stages.at(-1)).toMatchObject({
      stage: "measurement-validation",
      role: "reference",
      outcome: "failed",
    });
    expect(report.error).toContain("trusted policy");
  }
  changeInput(candidate, { bytes: 1100 });
}, 60_000);

test("CPU model, logical core count and RAM changes each fail exact identity matching", async () => {
  const machine = {
    host: "synthetic",
    cpuModels: ["CPU-A", "CPU-A"],
    memoryBytes: 8192,
  };
  for (const change of [
    { cpuModels: ["CPU-B", "CPU-B"] },
    { cpuModels: ["CPU-A"] },
    { memoryBytes: 8193 },
  ]) {
    const evidence = await prepare();
    changeInput(join(evidence, "reference"), {
      key: platformKey("local", machine),
    });
    changeInput(candidate, {
      key: platformKey("local", { ...machine, ...change }),
    });
    const { result, report } = runPair(evidence);
    expect(result.status).toBe(1);
    expect(report.error).toContain("full identities must match");
    expect(report.measurements.candidate.samples.idleRssBytes).toHaveLength(5);
  }
  changeInput(candidate, { bytes: 1100 });
}, 60_000);

test("invalid trusted policy retains its hash, and mismatched executing Bun cannot install", async () => {
  await expect(prepare({ referenceCommit: "main" })).rejects.toThrow(
    "full commit SHA",
  );
  const evidence = await prepare({ bun: "9.9.9" });
  const { result, report } = runPair(evidence);
  expect(result.status).toBe(1);
  expect(report.error).toContain("Executing Bun");
  expect(report.policy.sha256).toMatch(/^[a-f0-9]{64}$/);
  expect(
    report.stages.some((stage: { stage: string }) => stage.stage === "install"),
  ).toBe(false);
}, 30_000);

test("early policy failures retain stage/revision/hash and cannot overwrite a failed attempt", async () => {
  for (const before of ["0".repeat(40), "f".repeat(40), referenceCommit]) {
    const evidence = mkdtempSync(join(root, "early evidence "));
    const eventPath = join(evidence, "event.json");
    writeJson(eventPath, { ...event, before });
    const options = {
      evidence,
      candidate,
      candidateRevision: candidateCommit,
      eventName: "push",
      eventPath,
      runner: "local",
      policySource: source,
    };
    await expect(prepareCI(options)).rejects.toThrow();
    const original = readFileSync(join(evidence, "perf-result.json"), "utf8");
    const report = JSON.parse(original);
    expect(report.stages.at(-1).outcome).toBe("failed");
    expect(report.measurements).toEqual({});
    if (before !== "0".repeat(40)) expect(report.policy.revision).toBe(before);
    await expect(prepareCI(options)).rejects.toThrow("Evidence already exists");
    expect(readFileSync(join(evidence, "perf-result.json"), "utf8")).toBe(
      original,
    );
  }
}, 30_000);

test("workflow retains checkout/setup failures and uploads evidence unconditionally", () => {
  const workflow = readFileSync(
    resolve(".github/workflows/ci.yml"),
    "utf8",
  ).replaceAll("\r\n", "\n");
  const perf = workflow.slice(workflow.indexOf("\n  perf:"));
  expect(perf.indexOf("Initialize performance evidence")).toBeLessThan(
    perf.indexOf("actions/checkout@"),
  );
  expect(perf.indexOf("scripts/perf-ci.ts prepare")).toBeLessThan(
    perf.indexOf("oven-sh/setup-bun@"),
  );
  expect(perf).toContain(
    `bun-version: \${{ steps.policy.outputs.bun-version }}`,
  );
  expect(perf).not.toContain("bun-version-file");
  expect(perf).not.toContain("perf-candidate");
  expect(perf).toContain(
    "name: Retain workflow setup outcomes\n        if: always()",
  );
  expect(perf).toContain(
    "uses: actions/upload-artifact@v4\n        if: always()",
  );
  expect(perf).toContain("if-no-files-found: error");
  expect(perf).not.toContain("continue-on-error");
  const evidence = mkdtempSync(join(root, "workflow failed setup "));
  const outcomes = {
    checkout: { outcome: "failure" },
    node: { outcome: "skipped" },
    policy: { outcome: "skipped" },
    pair: { outcome: "skipped" },
  };
  const body = perf
    .split("      - name: Retain workflow setup outcomes\n")[1]
    .split("        run: |\n")[1]
    .split("      - uses: actions/upload-artifact")[0]
    .split("\n")
    .map((line) => line.slice(10))
    .join("\n")
    .replaceAll(/\$\{\{[^}]+\}\}/g, "fixture");
  const result = spawnSync(
    process.platform === "win32" ? "powershell" : "pwsh",
    ["-NoProfile", "-Command", body],
    {
      env: {
        ...process.env,
        LIZZY_PERF_EVIDENCE: evidence,
        STEP_OUTCOMES: JSON.stringify(outcomes),
      },
      encoding: "utf8",
      timeout: 10_000,
      windowsHide: true,
    },
  );
  expect(result.status).toBe(0);
  const retained = JSON.parse(
    readFileSync(join(evidence, "workflow-result.json"), "utf8").replace(
      /^\uFEFF/,
      "",
    ),
  );
  expect(retained.steps).toEqual(outcomes);
  expect(retained.diagnostics).toContain("Actions logs:");
});
