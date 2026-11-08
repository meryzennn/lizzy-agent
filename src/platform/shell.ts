import { accessSync, constants, statSync } from "node:fs";
import { isAbsolute, win32 } from "node:path";
import { run } from "./process";

function isWindowsBashPath(path: string): boolean {
  return (
    win32.isAbsolute(path) &&
    win32.parse(path).root.length > 1 &&
    win32.basename(path).toLowerCase() === "bash.exe" &&
    !/\\(?:system32|syswow64|sysnative)\\bash\.exe$/i.test(
      win32.normalize(path),
    )
  );
}

export function findGitBash(
  configured: string | undefined,
  env: NodeJS.ProcessEnv,
  probe: (path: string) => boolean,
): string {
  if (configured !== undefined) {
    if (!isWindowsBashPath(configured) || !probe(configured))
      throw new Error(
        "shell.bash must be an absolute path to an executable Git Bash bash.exe; check the configured path and install Git for Windows if needed.",
      );
    return configured;
  }
  const roots = [env.ProgramFiles, env.ProgramW6432, env["ProgramFiles(x86)"]];
  const candidates = roots.flatMap((root) =>
    root
      ? [
          win32.join(root, "Git", "bin", "bash.exe"),
          win32.join(root, "Git", "usr", "bin", "bash.exe"),
        ]
      : [],
  );
  if (env.LOCALAPPDATA)
    candidates.push(
      win32.join(env.LOCALAPPDATA, "Programs", "Git", "bin", "bash.exe"),
    );
  candidates.push(
    ...(env.PATH ?? env.Path ?? "")
      .split(";")
      .filter(Boolean)
      .map((dir) => win32.join(dir.replace(/^"|"$/g, ""), "bash.exe")),
  );
  const seen = new Set<string>();
  for (const candidate of candidates) {
    const key = win32.normalize(candidate).toLowerCase();
    if (!isWindowsBashPath(candidate) || seen.has(key)) continue;
    seen.add(key);
    if (probe(candidate)) return candidate;
  }
  throw new Error(
    "Git Bash not found. Install Git for Windows from https://git-scm.com/download/win or set shell.bash to the absolute path of its bash.exe.",
  );
}

function isBash(path: string): boolean {
  try {
    if (!statSync(path).isFile()) return false;
    accessSync(path, constants.X_OK);
    const env = { ...process.env };
    for (const key of Object.keys(env)) {
      if (["BASH_ENV", "ENV", "OSTYPE"].includes(key.toUpperCase()))
        delete env[key];
    }
    // Privileged mode also ignores imported functions and shell options.
    const output = run(
      [
        path,
        "--noprofile",
        "--norc",
        "-p",
        "-c",
        'builtin printf \'%s\\n\' "$BASH_VERSION" "$OSTYPE"',
      ],
      env,
    )
      .trim()
      .split(/\r?\n/);
    return (
      /^\d+\.\d+/.test(output[0] ?? "") &&
      (process.platform !== "win32" || output[1] === "msys")
    );
  } catch {
    return false;
  }
}

export function resolveShell(configured?: string): string {
  if (process.platform === "win32")
    return findGitBash(configured, process.env, isBash);
  const shell = configured ?? Bun.which("bash");
  if (!shell || !isAbsolute(shell) || !isBash(shell))
    throw new Error(
      "Bash not found or not executable; install Bash or set shell.bash to an absolute executable Bash path.",
    );
  return shell;
}
