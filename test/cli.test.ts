import { expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { version } from "../package.json";

const entry = resolve("src/cli.ts");
const invoke = (args: readonly string[], preload?: string) =>
  spawnSync(
    process.execPath,
    [...(preload ? ["--preload", preload] : []), entry, ...args],
    {
      encoding: "utf8",
      timeout: 10_000,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

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
mock.module(${JSON.stringify(pathToFileURL(resolve("src/app.ts")).href)}, () => ({
  start: async () => { throw new Error("Injected startup failure."); }
}));
`,
    );
    for (const flag of ["--help", "-h", "--version", "-v"]) {
      const result = invoke([flag], preload);
      expect(result.status).toBe(0);
      expect(result.stdout.length).toBeGreaterThan(0);
      expect(result.stderr).toBe("");
    }
    const result = invoke([], preload);
    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("Injected startup failure.");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
