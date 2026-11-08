import {
  getNativeClipboard,
  matchesKey,
  ProcessTerminal,
  TuiMainScreen,
} from "@earendil-works/pi-tui";
import { runSession } from "./compare";

export function runDemo() {
  return runSession("pi", (model) => {
    const tui = new TuiMainScreen(new ProcessTerminal());
    tui.addChild(model);
    let removeListener: (() => void) | undefined;
    return {
      nativeHelper:
        process.platform === "win32"
          ? getNativeClipboard()
            ? "loaded"
            : "unavailable"
          : "not required for headless Linux TTY",
      start(onInput) {
        removeListener = tui.addInputListener((data) => {
          onInput(data);
          return { consume: true };
        });
        tui.start();
      },
      paint: () => tui.requestRender(),
      stop() {
        removeListener?.();
        tui.stop();
      },
      exitKey: (key) =>
        matchesKey(key, "ctrl+c")
          ? "ctrl+c"
          : matchesKey(key, "escape")
            ? "escape"
            : undefined,
    };
  });
}
