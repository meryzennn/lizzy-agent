import { readFile, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { type Config, mergeConfig, parseConfig } from "../config";

async function readLayer(path: string) {
  let text: string;
  try {
    // Bun on Windows reports ENOENT when the parent exists as a regular file.
    if (!(await stat(dirname(path))).isDirectory())
      throw new Error("Configuration directory must be a directory.");
    if (!(await stat(path)).isFile())
      throw new Error("Configuration must be a regular file.");
    text = await readFile(path, "utf8");
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    )
      return {};
    throw new Error(
      `${path}: configuration cannot be read; check access permissions and file type.`,
    );
  }
  return parseConfig(text, path);
}

export async function loadConfig(
  cwd = process.cwd(),
  home = homedir(),
): Promise<Config> {
  const [global, project] = await Promise.all([
    readLayer(join(home, ".lizzy", "config.jsonc")),
    readLayer(join(cwd, ".lizzy", "config.jsonc")),
  ]);
  return mergeConfig(global, project);
}
