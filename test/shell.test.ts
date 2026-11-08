import { expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { findGitBash, resolveShell } from "../src/platform/shell";

const common = "C:\\Program Files\\Git\\bin\\bash.exe";
const portable = "D:\\Portable Git\\bin\\bash.exe";
const env = {
  ProgramFiles: "C:\\Program Files",
  PATH: 'C:\\Windows\\system32;"D:\\Portable Git\\bin"',
};

test("configured Git Bash wins over common installations and PATH", () => {
  const configured = "E:\\Custom Git\\bin\\bash.exe";
  const seen: string[] = [];
  expect(
    findGitBash(configured, env, (path) => {
      seen.push(path);
      return true;
    }),
  ).toBe(configured);
  expect(seen).toEqual([configured]);
});

test("common installations win over PATH, then PATH is used", () => {
  expect(
    findGitBash(undefined, env, (path) => [common, portable].includes(path)),
  ).toBe(common);
  expect(findGitBash(undefined, env, (path) => path === portable)).toBe(
    portable,
  );
});

test.each([
  [{ ProgramW6432: "D:\\Programs" }, "D:\\Programs\\Git\\usr\\bin\\bash.exe"],
  [
    { "ProgramFiles(x86)": "C:\\Program Files (x86)" },
    "C:\\Program Files (x86)\\Git\\bin\\bash.exe",
  ],
  [
    { LOCALAPPDATA: "C:\\Users\\tester\\AppData\\Local" },
    "C:\\Users\\tester\\AppData\\Local\\Programs\\Git\\bin\\bash.exe",
  ],
  [{ Path: '"D:\\Portable Git\\bin"' }, portable],
])("finds installation from %j", (environment, expected) => {
  expect(findGitBash(undefined, environment, (path) => path === expected)).toBe(
    expected,
  );
});

test("invalid explicit configuration never falls back", () => {
  const seen: string[] = [];
  expect(() =>
    findGitBash("E:\\Missing\\bash.exe", env, (path) => {
      seen.push(path);
      return path === common;
    }),
  ).toThrow("shell.bash");
  expect(seen).toEqual(["E:\\Missing\\bash.exe"]);
});

test.each([
  "",
  "relative\\bash.exe",
  "C:bash.exe",
  "\\Git\\bin\\bash.exe",
  "C:\\Git\\git-bash.exe",
])("rejects invalid configured target %j before probing", (configured) => {
  let probes = 0;
  expect(() =>
    findGitBash(configured, env, () => {
      probes++;
      return true;
    }),
  ).toThrow("shell.bash");
  expect(probes).toBe(0);
});

test.each([
  "C:\\Windows\\system32\\bash.exe",
  "c:/WINDOWS/System32/bash.exe",
  "D:\\Windows\\Sysnative\\bash.exe",
])("rejects WSL launcher %s before probing", (launcher) => {
  const seen: string[] = [];
  const environment = {
    PATH: `${launcher.slice(0, launcher.lastIndexOf(launcher.includes("/") ? "/" : "\\"))};D:\\Portable Git\\bin`,
  };
  expect(
    findGitBash(undefined, environment, (path) => {
      seen.push(path);
      return true;
    }),
  ).toBe(portable);
  expect(seen).toEqual([portable]);
  expect(() => findGitBash(launcher, environment, () => true)).toThrow(
    "shell.bash",
  );
});

test("missing Git Bash gives installation and configuration guidance", () => {
  expect(() => findGitBash(undefined, env, () => false)).toThrow(
    "https://git-scm.com/download/win",
  );
  expect(() => findGitBash(undefined, env, () => false)).toThrow("shell.bash");
});

test("duplicate Windows candidates are probed once and relative PATH entries are ignored", () => {
  const seen: string[] = [];
  expect(() =>
    findGitBash(
      undefined,
      {
        ProgramFiles: "C:\\Program Files",
        ProgramW6432: "c:\\program files",
        PATH: "C:\\Program Files\\Git\\bin;.;relative",
      },
      (path) => {
        seen.push(path);
        return false;
      },
    ),
  ).toThrow("Git Bash");
  expect(seen).toEqual([common, "C:\\Program Files\\Git\\usr\\bin\\bash.exe"]);
});

test("resolves actual Bash and preserves an explicit path containing spaces", () => {
  const shell = resolveShell();
  expect(resolveShell(shell)).toBe(shell);
  if (process.platform === "win32") expect(shell).toMatch(/bash\.exe$/i);
});

test("rejects missing, directory, non-executable and non-Bash configured targets", () => {
  const root = mkdtempSync(join(tmpdir(), "lizzy-shell-kind-"));
  const target = join(root, process.platform === "win32" ? "bash.exe" : "bash");
  try {
    expect(() => resolveShell(target)).toThrow("shell.bash");
    mkdirSync(target);
    expect(() => resolveShell(target)).toThrow("shell.bash");
    rmSync(target, { recursive: true });
    writeFileSync(target, "not an executable shell");
    expect(() => resolveShell(target)).toThrow("shell.bash");
    if (process.platform !== "win32") {
      chmodSync(target, 0o755);
      expect(() => resolveShell(target)).toThrow("shell.bash");
      expect(() => resolveShell("relative/bash")).toThrow("shell.bash");
    }
    expect(() => resolveShell(process.execPath)).toThrow("shell.bash");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("actual identification ignores startup files, inherited OS identity and PATH commands", () => {
  const root = mkdtempSync(join(tmpdir(), "lizzy-shell-startup-"));
  const startup = join(root, "startup.sh");
  const marker = join(root, "startup-ran");
  const shell = resolveShell();
  try {
    const script = "printf STARTUP_RAN > startup-ran; exit 77\n";
    for (const name of [".bashrc", ".bash_profile", ".profile", "startup.sh"])
      writeFileSync(join(root, name), script);
    const result = spawnSync(
      process.execPath,
      [
        "--eval",
        `import { resolveShell } from ${JSON.stringify(pathToFileURL(resolve("src/platform/shell.ts")).href)}; console.log(resolveShell(process.env.TEST_CONFIGURED_SHELL));`,
      ],
      {
        cwd: root,
        env: {
          ...process.env,
          HOME: root,
          USERPROFILE: root,
          PATH: root,
          Path: root,
          BASH_ENV: startup,
          ENV: startup,
          OSTYPE: "linux-gnu",
          TEST_CONFIGURED_SHELL: shell,
        },
        encoding: "utf8",
        timeout: 10_000,
        windowsHide: true,
      },
    );
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(0);
    expect(result.stdout).toBe(`${shell}\n`);
    expect(result.stderr).toBe("");
    expect(existsSync(marker)).toBe(false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
