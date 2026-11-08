import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { statSync } from "node:fs";
import { cpus, hostname, totalmem } from "node:os";

export function run(
  command: string[],
  env: NodeJS.ProcessEnv = process.env,
  timeoutMs = 10_000,
): string {
  if (!command[0]?.trim()) throw new Error("A subprocess command is required.");
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0)
    throw new Error("Subprocess timeout must be positive milliseconds.");
  const result = spawnSync(command[0], command.slice(1), {
    env,
    encoding: "utf8",
    timeout: timeoutMs,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.error || result.status !== 0) {
    throw new Error(
      `Process ${command[0]} failed: ${result.error?.message ?? (result.stderr || `exit ${result.status}, signal ${result.signal}`)}`,
    );
  }
  return result.stdout;
}

export const artifactBytes = (path: string): number => statSync(path).size;

export function platformKey(
  runner: string,
  machine = {
    host: hostname(),
    cpuModels: cpus().map((cpu) => cpu.model),
    memoryBytes: totalmem(),
  },
): string {
  if (
    !["local", "ubuntu-latest", "windows-latest", "macos-latest"].includes(
      runner,
    )
  )
    throw new Error("Unknown performance runner.");
  if (
    !machine.host.trim() ||
    !machine.cpuModels.length ||
    machine.cpuModels.some((model) => !model.trim()) ||
    !Number.isFinite(machine.memoryBytes) ||
    machine.memoryBytes <= 0
  )
    throw new Error("Incomplete performance machine identity.");
  const hardware = {
    cpuModels: machine.cpuModels.map((model) => model.trim()).sort(),
    memoryBytes: machine.memoryBytes,
  };
  const identity =
    runner === "local" ? { host: machine.host, ...hardware } : hardware;
  const fingerprint = createHash("sha256")
    .update(JSON.stringify(identity))
    .digest("hex");
  return `${process.platform}-${process.arch}-${runner === "local" ? "local" : `ci-${runner}`}-${fingerprint}`;
}
