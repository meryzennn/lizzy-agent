import { loadConfig } from "./platform/config";
import { resolveShell } from "./platform/shell";

export async function start(): Promise<number> {
  const config = await loadConfig();
  resolveShell(config.shell.bash);
  process.stderr.write(
    "Skeleton ready. Model calls and the agent loop are not available yet.\n",
  );
  return 0;
}
