import { expect, test } from "bun:test";
import { matchesKey } from "@earendil-works/pi-tui";
import { containsEcho, diffFrame, EchoProbe, Transcript } from "./compare";

test("diffs changed and removed lines inside synchronized frames", () => {
  expect(diffFrame(["a", "b"], ["a", "c"])).toBe(
    "\x1b[?2026h\x1b[2;1H\x1b[2Kc\x1b[?2026l",
  );
  expect(diffFrame(["a"], ["a"])).toBe("");
  expect(diffFrame(["a", "b"], ["a"])).toContain("\x1b[2;1H\x1b[2K");
});

test("only a complete input line is an echo", () => {
  expect(containsEcho("stream token abc", "abc")).toBe(false);
  expect(containsEcho("\x1b[32m> abc\x1b[0m", "abc")).toBe(true);
  expect(containsEcho("> abcd", "abc")).toBe(false);
  expect(
    containsEcho(diffFrame(["old", "> ab"], ["token-3", "> abc"]), "abc"),
  ).toBe(true);
  expect(containsEcho("\r\x1b[2K> abc\x1b[0m\x1b]8;;\x07", "abc")).toBe(true);
});

test("probe ignores streaming and stale frames, accepts split writes", () => {
  const probe = new EchoProbe();
  probe.input("a", "", 10);
  probe.write("token-1", 11);
  expect(probe.samplesMs).toEqual([]);
  probe.write("\r\n> a", 12);
  expect(probe.samplesMs).toEqual([2]);
  probe.input("b", "a", 20);
  probe.write("\r\n> a", 21);
  probe.write("b", 24);
  expect(probe.samplesMs).toEqual([2, 4]);
  probe.input("c", "ab", 30);
  expect(probe.unanswered).toBe(1);
});

test("fixture submits and clips safely at narrow widths", () => {
  const model = new Transcript();
  model.handleInput("abc");
  expect(model.render(120)).toEqual(["", "> abc"]);
  model.handleInput("\r");
  model.tick();
  expect(model.render(120)).toEqual([" abc token-0", "> "]);
  expect(model.render(1).every((line) => line.length <= 1)).toBe(true);
});

test.each([
  ["\x03", "ctrl+c"],
  ["\x1b[99;5u", "ctrl+c"],
  ["\x1b[27;5;99~", "ctrl+c"],
  ["\x1b", "escape"],
  ["\x1b[27u", "escape"],
] as const)("pi recognizes %j as %s", (data, key) => {
  expect(matchesKey(data, key)).toBe(true);
});

test("pi does not exit for arrows or ordinary letters", () => {
  for (const data of ["\x1b[A", "c"]) {
    expect(matchesKey(data, "ctrl+c") || matchesKey(data, "escape")).toBe(
      false,
    );
  }
});
