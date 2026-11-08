import { parseArgs } from "node:util";
import { version } from "../package.json";

export async function main(args: string[]): Promise<number> {
  let flags: { help?: boolean; version?: boolean };
  try {
    flags = parseArgs({
      args,
      strict: true,
      allowPositionals: false,
      options: {
        help: { type: "boolean", short: "h" },
        version: { type: "boolean", short: "v" },
      },
    }).values;
  } catch {
    process.stderr.write("Invalid arguments. Run agent --help for usage.\n");
    return 2;
  }
  if (flags.help) {
    process.stdout.write(
      "Usage: agent [--help | --version]\n\n  -h, --help     Show usage\n  -v, --version  Show version\n\nSkeleton CLI; model calls and the agent loop are not available yet.\n",
    );
    return 0;
  }
  if (flags.version) {
    process.stdout.write(`${version}\n`);
    return 0;
  }
  const { start } = await import("./app");
  return start();
}

if (import.meta.main) {
  try {
    process.exitCode = await main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : "Startup failed; check the installation."}\n`,
    );
    process.exitCode = 1;
  }
}
