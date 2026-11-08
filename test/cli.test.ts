import { expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { version } from "../package.json";

const entry = resolve("src/cli.ts");
const invoke = (
  args: readonly string[],
  options: { preload?: string; cwd?: string; home?: string } = {},
) => {
  const directory = mkdtempSync(join(tmpdir(), "lizzy-cli-env-"));
  const home = options.home ?? directory;
  try {
    return spawnSync(
      process.execPath,
      [
        ...(options.preload ? ["--preload", options.preload] : []),
        entry,
        ...args,
      ],
      {
        cwd: options.cwd ?? directory,
        env: { ...process.env, HOME: home, USERPROFILE: home },
        encoding: "utf8",
        timeout: 10_000,
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
};

test.each(["--help", "-h"])("%s prints usage without startup", (flag) => {
  const result = invoke([flag]);
  expect(result.status).toBe(0);
  expect(result.stdout).toContain("Usage: agent");
  expect(result.stdout).toContain("--help");
  expect(result.stdout).toContain("--version");
  expect(result.stderr).toBe("");
});

test.each(["--version", "-v"])("%s prints only the package version", (flag) => {
  const result = invoke([flag]);
  expect(result.status).toBe(0);
  expect(result.stdout).toBe(`${version}\n`);
  expect(result.stderr).toBe("");
});

test.each([
  { args: ["--unknown"] },
  { args: ["prompt"] },
  { args: ["--help", "--unknown"] },
  { args: ["--version", "prompt"] },
  { args: ["--version=false"] },
])("invalid arguments %j return usage on stderr", ({ args }) => {
  const result = invoke(args);
  expect(result.status).toBe(2);
  expect(result.stdout).toBe("");
  expect(result.stderr).toContain("--help");
});

test("normal startup is an honest skeleton on stderr", () => {
  const result = invoke([]);
  expect(result.status).toBe(0);
  expect(result.stdout).toBe("");
  expect(result.stderr).toContain("Skeleton");
  expect(result.stderr).toContain("not available");
});

test("startup failure exits 1 while informational flags still succeed", () => {
  const directory = mkdtempSync(join(tmpdir(), "lizzy-cli-test-"));
  const preload = join(directory, "startup-error.ts");
  try {
    writeFileSync(
      preload,
      `import { mock } from "bun:test";
mock.module(${JSON.stringify(pathToFileURL(resolve("src/app.ts")).href)}, () => {
  process.stderr.write("APP_IMPORT_SENTINEL\\n");
  return {
  start: async () => { throw new Error("Injected startup failure."); }
  };
});
`,
    );
    for (const flag of ["--help", "-h", "--version", "-v"]) {
      const result = invoke([flag], { preload });
      expect(result.status).toBe(0);
      expect(result.stdout.length).toBeGreaterThan(0);
      expect(result.stderr).not.toContain("APP_IMPORT_SENTINEL");
      expect(result.stderr).toBe("");
    }
    const result = invoke([], { preload });
    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe(
      "APP_IMPORT_SENTINEL\nInjected startup failure.\n",
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test.each(["home", "project"])(
  "invalid %s configuration blocks startup but all informational flags succeed",
  (location) => {
    const root = mkdtempSync(join(tmpdir(), "lizzy-cli-config-"));
    const home = join(root, "home");
    const cwd = join(root, "project");
    const path = join(root, location, ".lizzy", "config.jsonc");
    try {
      mkdirSync(home);
      mkdirSync(cwd);
      mkdirSync(join(root, location, ".lizzy"));
      writeFileSync(path, '{"secret":"FAKE_SECRET_NEVER_REAL",');
      for (const flag of ["--help", "-h", "--version", "-v"]) {
        const result = invoke([flag], { cwd, home });
        expect(result.status).toBe(0);
        expect(result.stdout.length).toBeGreaterThan(0);
        expect(result.stderr).toBe("");
      }
      const result = invoke([], { cwd, home });
      expect(result.status).toBe(1);
      expect(result.stdout).toBe("");
      expect(result.stderr).toContain(path);
      expect(result.stderr).toContain("JSONC");
      expect(result.stderr).not.toContain("FAKE_SECRET_NEVER_REAL");
      expect(result.stderr).not.toContain("Skeleton");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  },
);
