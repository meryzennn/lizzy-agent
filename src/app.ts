import { loadConfig } from "./platform/config";

export async function start(): Promise<number> {
  await loadConfig();
  process.stderr.write(
    "Skeleton ready. Model calls and the agent loop are not available yet.\n",
  );
  return 0;
}
