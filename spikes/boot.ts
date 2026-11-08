if (process.argv.includes("--version")) {
  process.stdout.write("hello 0.0.0\n");
} else if (process.env.LIZZY_PERF_PROBE === "1") {
  await Bun.sleep(200);
  process.stdout.write(
    `${JSON.stringify({ rss: process.memoryUsage().rss })}\n`,
  );
} else {
  process.stdout.write("hello\n");
}

export {};
