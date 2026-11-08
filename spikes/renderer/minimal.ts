import { diffFrame, runSession } from "./compare";

export function runDemo() {
  return runSession("minimal", (model) => {
    let previous: string[] = [];
    let input: ((data: Buffer | string) => void) | undefined;
    return {
      start(onInput) {
        process.stdout.write("\x1b[?1049h\x1b[2J\x1b[?25l");
        process.stdin.setRawMode(true);
        input = (data) => onInput(data.toString());
        process.stdin.on("data", input);
        process.stdin.resume();
      },
      paint() {
        const next = model.render(process.stdout.columns);
        process.stdout.write(diffFrame(previous, next));
        previous = next;
      },
      stop() {
        if (input) process.stdin.off("data", input);
        process.stdout.write("\x1b[?1049l");
      },
      exitKey: (key) =>
        key.includes("\x03")
          ? "ctrl+c"
          : key.includes("\x1b")
            ? "escape"
            : undefined,
    };
  });
}
