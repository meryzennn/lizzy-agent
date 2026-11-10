import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { cpus, release, totalmem } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { Measurement } from "./measure-perf";

const repository = "meryzennn/lizzy-agent";
const policyFile = "docs/perf/ci-reference.json";
type Policy = {
  schemaVersion: 1;
  repository: string;
  referenceCommit: string;
  bun: string;
  workload: string;
  binaryLimitBytes: { "linux-x64": number; "win32-x64": number };
};
function sha(value: unknown): string {
  if (
    typeof value !== "string" ||
    !/^[a-f0-9]{40}$/.test(value) ||
    /^0+$/.test(value)
  )
    throw new Error("An available, nonzero full commit SHA is required.");
  return value;
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Expected an object.");
  return value as Record<string, unknown>;
}
function keys(value: Record<string, unknown>, names: string[]) {
  if (
    Object.keys(value).length !== names.length ||
    names.some((name) => !Object.hasOwn(value, name))
  )
    throw new Error("Unexpected or missing policy fields.");
}
export function parsePolicy(value: unknown): Policy {
  const data = object(value);
  keys(data, [
    "schemaVersion",
    "repository",
    "referenceCommit",
    "bun",
    "workload",
    "binaryLimitBytes",
  ]);
  sha(data.referenceCommit);
  if (
    data.schemaVersion !== 1 ||
    data.repository !== repository ||
    typeof data.bun !== "string" ||
    !/^\d+\.\d+\.\d+$/.test(data.bun) ||
    data.workload !== "agent-f00-v1"
  )
    throw new Error(
      "Unsupported policy schema, repository, Bun pin or workload.",
    );
  const caps = object(data.binaryLimitBytes);
  keys(caps, ["linux-x64", "win32-x64"]);
  for (const cap of Object.values(caps))
    if (typeof cap !== "number" || !Number.isSafeInteger(cap) || cap <= 0)
      throw new Error("Native caps must be positive integer bytes.");
  return data as Policy;
}
export function policyRevision(name: string, input: unknown): string {
  const event = object(input);
  if (object(event.repository).full_name !== repository)
    throw new Error("Expected the explicit base repository.");
  if (name === "pull_request") {
    const base = object(object(event.pull_request).base);
    if (object(base.repo).full_name !== repository)
      throw new Error("Unexpected PR base repository.");
    return sha(base.sha);
  }
  if (name === "push" && event.ref === "refs/heads/main")
    return sha(event.before);
  throw new Error(
    "Only pull_request or push to main has a trusted policy revision.",
  );
}
const hash = (data: string | Buffer) =>
  createHash("sha256").update(data).digest("hex");
type Stage = {
  stage: string;
  role: string;
  argv?: string[];
  cwd?: string;
  outcome: string;
  stdout?: string;
  stderr?: string;
  status?: number | null;
  signal?: string | null;
  error?: string;
};
type Context = {
  candidate: string;
  candidateRevision: string;
  reference: string;
  policy: Policy;
  policyRevision: string;
  policySha256: string;
  policySource: string;
  runner: string;
};
type Report = {
  context?: Context;
  policy?: Record<string, unknown>;
  environment?: Record<string, unknown>;
  stages: Stage[];
  artifacts: Record<string, Record<string, unknown>>;
  measurements: Partial<Record<"reference" | "candidate", Measurement>>;
  failures?: string[];
  error?: string;
};
class Evidence {
  report: Report;
  path: string;
  constructor(directory: string, existing = false) {
    mkdirSync(directory, { recursive: true });
    this.path = join(directory, "perf-result.json");
    if (!existing && existsSync(this.path))
      throw new Error(
        "Evidence already exists; retain it and use a new directory for a separately authorized run.",
      );
    this.report = existing
      ? JSON.parse(readFileSync(this.path, "utf8"))
      : { stages: [], artifacts: {}, measurements: {} };
    this.save();
  }
  save() {
    writeFileSync(this.path, `${JSON.stringify(this.report, null, 2)}\n`);
  }
  async stage<T>(
    stage: string,
    role: string,
    action: (record: Stage) => T | Promise<T>,
    argv?: string[],
    cwd?: string,
  ): Promise<T> {
    const record: Stage = { stage, role, argv, cwd, outcome: "running" };
    this.report.stages.push(record);
    this.save();
    try {
      const result = await action(record);
      record.outcome = "succeeded";
      return result;
    } catch (error) {
      record.outcome = "failed";
      record.error = error instanceof Error ? error.stack : String(error);
      this.report.error = record.error;
      throw error;
    } finally {
      this.save();
    }
  }
  command(stage: string, role: string, argv: string[], cwd: string) {
    return this.stage(
      stage,
      role,
      (record) => {
        const result = spawnSync(argv[0], argv.slice(1), {
          cwd,
          env: process.env,
          encoding: "utf8",
          timeout: 120_000,
          maxBuffer: 16 * 1024 * 1024,
          windowsHide: true,
          stdio: ["ignore", "pipe", "pipe"],
        });
        Object.assign(record, {
          stdout: result.stdout,
          stderr: result.stderr,
          status: result.status,
          signal: result.signal,
        });
        if (result.error || result.status !== 0)
          throw (
            result.error ??
            new Error(result.stderr || `Process exited ${result.status}`)
          );
        return result.stdout;
      },
      argv,
      cwd,
    );
  }
}
export type PrepareOptions = {
  evidence: string;
  candidate: string;
  candidateRevision: string;
  eventName: string;
  eventPath: string;
  runner: string;
  // Explicit local fixtures use the same fetch path; production never reads an override.
  policySource?: string;
};
export async function prepareCI(options: PrepareOptions): Promise<void> {
  const evidence = resolve(options.evidence);
  const log = new Evidence(evidence);
  await log.stage("environment", "orchestrator", () => {
    log.report.environment = {
      mode: options.policySource ? "pre-adoption-local-fixture" : "native-ci",
      os: process.platform,
      arch: process.arch,
      osRelease: release(),
      cpuModels: cpus()
        .map((cpu) => cpu.model.trim())
        .sort(),
      memoryBytes: totalmem(),
      runner: options.runner,
      image: process.env.ImageOS,
      imageVersion: process.env.ImageVersion,
      eventCommit: options.candidateRevision,
      node: process.version,
    };
  });
  const revision = await log.stage("policy-selection", "policy", () =>
    policyRevision(
      options.eventName,
      JSON.parse(readFileSync(options.eventPath, "utf8")),
    ),
  );
  const source = options.policySource ?? `https://github.com/${repository}.git`;
  log.report.policy = { repository, revision, file: policyFile, source };
  log.save();
  const candidate = resolve(options.candidate);
  const policyCheckout = join(evidence, "policy");
  const reference = join(evidence, "reference");
  async function checkout(role: string, path: string, commit: string) {
    await log.command("checkout-init", role, ["git", "init", path], evidence);
    await log.command(
      "checkout-fetch",
      role,
      ["git", "fetch", "--depth=1", source, commit],
      path,
    );
    await log.command(
      "checkout",
      role,
      ["git", "checkout", "--detach", "FETCH_HEAD"],
      path,
    );
    const actual = (
      await log.command("revision", role, ["git", "rev-parse", "HEAD"], path)
    ).trim();
    await log.stage("revision-validation", role, () => {
      if (actual !== commit)
        throw new Error("Resolved source revision differs from requested SHA.");
    });
  }
  await checkout("policy", policyCheckout, revision);
  const rawPolicy = await log.stage("policy-file", "policy", () =>
    readFileSync(join(policyCheckout, policyFile)),
  );
  log.report.policy.sha256 = hash(rawPolicy);
  log.save();
  const policy = await log.stage("policy-validation", "policy", () =>
    parsePolicy(JSON.parse(rawPolicy.toString("utf8"))),
  );
  log.report.context = {
    candidate,
    candidateRevision: options.candidateRevision,
    reference,
    policy,
    policyRevision: revision,
    policySha256: hash(rawPolicy),
    policySource: source,
    runner: options.runner,
  };
  log.save();
  await checkout("reference", reference, policy.referenceCommit);
  const actual = (
    await log.command(
      "revision",
      "candidate",
      ["git", "rev-parse", "HEAD"],
      candidate,
    )
  ).trim();
  await log.stage("revision-validation", "candidate", () => {
    if (actual !== sha(options.candidateRevision))
      throw new Error("Candidate checkout does not match the event revision.");
  });
  if (process.env.GITHUB_OUTPUT)
    appendFileSync(process.env.GITHUB_OUTPUT, `bun-version=${policy.bun}\n`);
}

function dependencyHash(directory: string): string {
  const digest = createHash("sha256");
  function visit(path: string, relative: string) {
    for (const name of readdirSync(path).sort()) {
      const file = join(path, name);
      const key = join(relative, name);
      if (statSync(file).isDirectory()) visit(file, key);
      else
        digest.update(key).update("\0").update(readFileSync(file)).update("\0");
    }
  }
  if (existsSync(directory)) visit(directory, "");
  return digest.digest("hex");
}

export async function measurePair(directory: string): Promise<void> {
  const evidence = resolve(directory);
  const log = new Evidence(evidence, true);
  if (log.report.stages.some((stage) => stage.stage === "context"))
    throw new Error(
      "This pair has already been attempted; retain its evidence.",
    );
  const context = await log.stage("context", "orchestrator", () => {
    if (!log.report.context)
      throw new Error("Prepare the trusted policy and checkouts first.");
    parsePolicy(log.report.context.policy);
    return log.report.context;
  });
  const { policy, candidate, reference, runner } = context;
  const platform = `${process.platform}-${process.arch}`;
  const cap = await log.stage("toolchain", "orchestrator", () => {
    if (Bun.version !== policy.bun)
      throw new Error("Executing Bun does not match trusted policy.");
    if (platform !== "linux-x64" && platform !== "win32-x64")
      throw new Error("Unsupported native platform/cap.");
    if (
      runner !== "local" &&
      runner !==
        (process.platform === "win32" ? "windows-latest" : "ubuntu-latest")
    )
      throw new Error("Runner does not match the native platform.");
    log.report.environment = {
      ...log.report.environment,
      bun: Bun.version,
      bunExecutable: process.execPath,
      bunSha256: hash(readFileSync(process.execPath)),
    };
    return policy.binaryLimitBytes[platform];
  });
  for (const [role, checkout] of [
    ["reference", reference],
    ["candidate", candidate],
  ] as const) {
    await log.stage("build-inputs", role, async () => {
      const files = (
        await log.command(
          "source-files",
          role,
          ["git", "ls-files", "-z"],
          checkout,
        )
      )
        .split("\0")
        .filter(Boolean);
      const inputs = Object.fromEntries(
        files.map((file) => [file, hash(readFileSync(join(checkout, file)))]),
      );
      const buildInputs = Object.fromEntries(
        Object.entries(inputs).filter(
          ([file]) =>
            file.startsWith("src/") ||
            [
              "scripts/build.ts",
              "package.json",
              "bun.lock",
              ".bun-version",
              "tsconfig.json",
              "bunfig.toml",
            ].includes(file),
        ),
      );
      log.report.artifacts[role] = {
        checkout,
        revision:
          role === "reference"
            ? policy.referenceCommit
            : context.candidateRevision,
        sourceSha256: hash(JSON.stringify(inputs)),
        inputSha256: inputs,
        buildInputSha256: hash(JSON.stringify(buildInputs)),
        lockfileSha256: inputs["bun.lock"],
        packageSha256: inputs["package.json"],
      };
      const pkg = JSON.parse(
        readFileSync(join(checkout, "package.json"), "utf8"),
      );
      if (
        readFileSync(join(checkout, ".bun-version"), "utf8").trim() !==
          policy.bun ||
        pkg.engines?.bun !== policy.bun
      )
        throw new Error("Build input Bun pin does not match trusted policy.");
      if (!inputs["bun.lock"])
        throw new Error("Each checkout requires its own frozen lockfile.");
      log.report.artifacts[role].dependencies = pkg.dependencies;
    });
    await log.command(
      "install",
      role,
      [process.execPath, "install", "--frozen-lockfile"],
      checkout,
    );
    await log.stage("dependencies", role, () => {
      log.report.artifacts[role].installedDependencySha256 = dependencyHash(
        join(checkout, "node_modules"),
      );
    });
  }
  const harness = await log.stage("harness", "reference", async () => {
    const perf = (await import(
      pathToFileURL(join(reference, "scripts", "perf.ts")).href
    )) as typeof import("./perf");
    const measurement = (await import(
      pathToFileURL(join(reference, "scripts", "measure-perf.ts")).href
    )) as typeof import("./measure-perf");
    const platformModule = (await import(
      pathToFileURL(join(reference, "src", "platform", "process.ts")).href
    )) as typeof import("../src/platform/process");
    log.report.artifacts.reference.harnessRevision = policy.referenceCommit;
    return { ...perf, ...measurement, ...platformModule };
  });
  const previousCwd = process.cwd();
  const previousEnv = { ...process.env };
  try {
    for (const [role, checkout] of [
      ["reference", reference],
      ["candidate", candidate],
    ] as const) {
      const argv = [process.execPath, "run", "build"];
      await log.stage(
        "build",
        role,
        (record) => {
          process.chdir(checkout);
          record.stdout = harness.run(argv, process.env, 120_000);
        },
        argv,
        checkout,
      );
      await log.stage("binary", role, () => {
        const binary = join(
          checkout,
          "dist",
          process.platform === "win32" ? "agent.exe" : "agent",
        );
        Object.assign(log.report.artifacts[role], {
          binary,
          binarySha256: hash(readFileSync(binary)),
          binaryBytes: statSync(binary).size,
        });
      });
    }
    for (const role of ["reference", "candidate"] as const) {
      const binary = log.report.artifacts[role].binary as string;
      const runtime = join(evidence, `${role}-runtime`);
      const home = join(runtime, "home");
      const cwd = join(runtime, "cwd");
      await log.stage("runtime", role, () => {
        mkdirSync(runtime);
        mkdirSync(home);
        mkdirSync(cwd);
        process.chdir(cwd);
        process.env.HOME = home;
        process.env.USERPROFILE = home;
        // Keep PATH/LOCALAPPDATA/ProgramFiles equal so native Git Bash discovery is unchanged.
        Object.assign(log.report.artifacts[role], {
          runtime: {
            home,
            cwd,
            initiallyEmpty:
              readdirSync(home).length === 0 && readdirSync(cwd).length === 0,
          },
        });
      });
      await log.stage(
        "measure",
        role,
        () => {
          try {
            log.report.measurements[role] = harness.measure(
              [binary],
              binary,
              policy.workload,
              runner,
            );
          } catch (error) {
            log.report.artifacts[role].incompleteSamples =
              "Unavailable: pinned measure() does not expose partial sample arrays on failure.";
            throw error;
          }
        },
        [binary],
        cwd,
      );
      await log.stage("measurement-validation", role, () => {
        const value = harness.measurementSchema.parse(
          log.report.measurements[role],
        );
        if (
          value.samples.versionMs.length !== 15 ||
          value.samples.idleRssBytes.length !== 5
        )
          throw new Error("Expected all 15 startup and 5 RSS samples.");
        if (value.bun !== policy.bun || value.workload !== policy.workload)
          throw new Error(
            "Measurement Bun/workload differs from trusted policy.",
          );
        const prefix = `${platform}-${runner === "local" ? "local" : `ci-${runner}`}-`;
        if (!value.key.startsWith(prefix))
          throw new Error(
            "Measurement identity differs from native platform/runner.",
          );
        for (const metric of ["versionMs", "idleRssBytes"] as const) {
          const samples = [...value.samples[metric]].sort((a, b) => a - b);
          if (samples[Math.floor(samples.length / 2)] !== value.metrics[metric])
            throw new Error(
              "Measurement median does not match its complete samples.",
            );
        }
        if (
          value.metrics.binaryBytes !== log.report.artifacts[role].binaryBytes
        )
          throw new Error(
            "Measurement binary bytes differ from the built artifact.",
          );
      });
    }
    await log.stage("comparison", "pair", () => {
      const base = log.report.measurements.reference;
      const current = log.report.measurements.candidate;
      if (
        !base ||
        !current ||
        base.key !== current.key ||
        base.bun !== current.bun ||
        base.workload !== current.workload
      )
        throw new Error("Reference and candidate full identities must match.");
      log.report.failures = harness.checkPerformance(
        { schemaVersion: 1, entries: [{ ...base, binaryLimitBytes: cap }] },
        current,
      );
      if (log.report.failures.length)
        throw new Error(log.report.failures.join("\n"));
    });
  } finally {
    process.chdir(previousCwd);
    for (const key of Object.keys(process.env))
      if (!(key in previousEnv)) delete process.env[key];
    Object.assign(process.env, previousEnv);
    log.save();
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    const evidence = process.env.LIZZY_PERF_EVIDENCE;
    if (!evidence)
      throw new Error(
        "LIZZY_PERF_EVIDENCE must name a fresh evidence directory.",
      );
    if (process.argv[2] === "prepare") {
      await prepareCI({
        evidence,
        candidate: process.cwd(),
        candidateRevision: process.env.GITHUB_SHA ?? "",
        eventName: process.env.GITHUB_EVENT_NAME ?? "",
        eventPath: process.env.GITHUB_EVENT_PATH ?? "",
        runner: process.env.LIZZY_PERF_RUNNER ?? "",
      });
    } else if (process.argv[2] === "measure") await measurePair(evidence);
    else throw new Error("Usage: perf-ci.ts prepare|measure");
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  }
}
