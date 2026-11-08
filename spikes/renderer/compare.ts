export function diffFrame(previous: string[], next: string[]): string {
  let output = "";
  for (let i = 0; i < Math.max(previous.length, next.length); i++) {
    if (previous[i] !== next[i])
      output += `\x1b[${i + 1};1H\x1b[2K${next[i] ?? ""}`;
  }
  return output ? `\x1b[?2026h${output}\x1b[?2026l` : "";
}

export function containsEcho(frame: string, input: string): boolean {
  return frame
    // biome-ignore lint/suspicious/noControlCharactersInRegex: remove terminal OSC resets from echo text.
    .replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, "")
    // biome-ignore lint/suspicious/noControlCharactersInRegex: cursor moves separate painted lines.
    .replace(/\x1b\[[0-?]*[ -/]*[ABCDEFGHJKSTf]/g, "\n")
    // biome-ignore lint/suspicious/noControlCharactersInRegex: ignore CSI styling and synchronization.
    .replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, "")
    .split(/[\r\n]/)
    .some((line) => line === `> ${input}`);
}

export class EchoProbe {
  samplesMs: number[] = [];
  private pending: Array<{ at: number; expected: string }> = [];
  private frame = "";
  get unanswered() {
    return this.pending.length;
  }
  input(key: string, typed: string, at: number) {
    if (!/^[a-z]$/.test(key)) return;
    this.frame = "";
    this.pending.push({ at, expected: typed + key });
  }
  write(chunk: string, at: number) {
    this.frame = (this.frame + chunk).slice(-32768);
    this.pending = this.pending.filter((sample) => {
      if (!containsEcho(this.frame, sample.expected)) return true;
      this.samplesMs.push(at - sample.at);
      return false;
    });
  }
}

// shortcut: ASCII two-line fixture only; production editor/scrollback belongs to Phase 9.
export class Transcript {
  typed = "";
  transcript = "";
  ticks = 0;
  submits = 0;
  render(width: number): string[] {
    const usable = Math.max(1, width - 1);
    return [this.transcript.slice(-usable), `> ${this.typed}`.slice(0, usable)];
  }
  invalidate() {}
  tick() {
    this.transcript = `${this.transcript} token-${this.ticks++}`.slice(-4096);
  }
  handleInput(data: string) {
    for (const ch of data) {
      if (ch === "\r") {
        this.transcript = `${this.transcript} ${this.typed}`.slice(-4096);
        this.typed = "";
        this.submits++;
      } else if (ch === "\x7f") this.typed = this.typed.slice(0, -1);
      else if (ch >= " " && ch <= "~") this.typed += ch;
    }
  }
}

export interface Renderer {
  nativeHelper?: string;
  start(onInput: (key: string) => void): void;
  paint(): void;
  stop(): void;
  exitKey(key: string): string | undefined;
}

export async function runSession(
  kind: string,
  create: (model: Transcript) => Renderer,
) {
  if (!process.stdin.isTTY || !process.stdout.isTTY)
    throw new Error(
      "Run this spike in a native interactive terminal (stdin and stdout must be TTYs).",
    );
  const model = new Transcript();
  const probe = new EchoProbe();
  const renderer = create(model);
  const originalWrite = process.stdout.write;
  const wasRaw = process.stdin.isRaw;
  const listenersBefore = process.stdin.listenerCount("data");
  const widths = [process.stdout.columns];
  let timer: ReturnType<typeof setInterval> | undefined;
  let exitControl = "error";
  let failure: unknown;
  const rawInput = (data: Buffer | string) =>
    probe.input(data.toString(), model.typed, performance.now());
  process.stdout.write = new Proxy(originalWrite, {
    apply(target, receiver, args) {
      const result = Reflect.apply(target, receiver, args);
      probe.write(String(args[0]), performance.now());
      return result;
    },
  });
  process.stdin.prependListener("data", rawInput);
  let finish: (error?: unknown) => void = () => {};
  const safely = (action: () => void) => {
    try {
      action();
    } catch (error) {
      finish(error);
    }
  };
  const resize = () =>
    safely(() => {
      widths.push(process.stdout.columns);
      renderer.paint();
    });
  const signal = () => {
    exitControl = "SIGINT";
    finish();
  };
  const exception = (error: Error) => finish(error);
  process.stdout.on("resize", resize);
  process.on("SIGINT", signal);
  process.on("uncaughtException", exception);
  try {
    await new Promise<void>((resolve, reject) => {
      let finished = false;
      finish = (error) => {
        if (finished) return;
        finished = true;
        if (error) reject(error);
        else resolve();
      };
      renderer.start((key) =>
        safely(() => {
          const control = renderer.exitKey(key);
          if (control) {
            exitControl = control;
            finish();
            return;
          }
          model.handleInput(key);
          renderer.paint();
        }),
      );
      timer = setInterval(
        () =>
          safely(() => {
            model.tick();
            renderer.paint();
          }),
        34,
      );
      renderer.paint();
      if (process.env.RENDERER_SPIKE_FAIL === "1")
        throw new Error("Injected lifecycle failure");
    });
  } catch (error) {
    failure = error;
  } finally {
    clearInterval(timer);
    try {
      renderer.stop();
    } catch (error) {
      failure ??= error;
    }
    process.stdin.off("data", rawInput);
    process.stdout.off("resize", resize);
    process.off("SIGINT", signal);
    process.off("uncaughtException", exception);
    process.stdin.setRawMode(wasRaw);
    process.stdin.pause();
    process.stdout.write = originalWrite;
    originalWrite.call(process.stdout, "\x1b[?2026l\x1b[?25h");
  }
  const sorted = [...probe.samplesMs].sort((a, b) => a - b);
  process.stderr.write(
    `${JSON.stringify({
      kind,
      bun: Bun.version,
      platform: process.platform,
      arch: process.arch,
      samplesMs: probe.samplesMs,
      inputToWriteP95Ms: sorted[Math.ceil(sorted.length * 0.95) - 1] ?? null,
      unanswered: probe.unanswered,
      ticks: model.ticks,
      submits: model.submits,
      widths,
      exitControl,
      rawRestored: process.stdin.isRaw === wasRaw,
      listenersRestored:
        process.stdin.listenerCount("data") === listenersBefore,
      nativeHelper: renderer.nativeHelper ?? "not used",
      error:
        failure instanceof Error
          ? failure.message
          : failure
            ? String(failure)
            : null,
    })}\n`,
  );
  if (failure) throw failure;
}
