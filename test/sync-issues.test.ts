import { expect, test } from "bun:test";
import {
  githubSlug,
  issueBody,
  issueTitle,
  parsePhase,
} from "../scripts/sync-issues";

const source = [
  "# Fase 0 — Skeleton",
  "<!--",
  "## Task F00-T99 — Contoh template",
  "-->",
  "## Task F00-T01 — CLI ringan",
  "- **Type:** feat",
  "- **Labels:** `os:windows`, spec-change",
  "- **Bergantung pada:** —",
  "### Langkah",
  "- [ ] Detail implementasi hanya di spec.",
  "### Selesai bila",
  "- [ ] Help bekerja.",
  "### Catatan",
  "Catatan bukan acceptance.",
  "## Task F00-T02 – Harness",
  "- **Type:** test",
  "- **Bergantung pada:** F00-T01, F01-T03",
  "### Selesai bila",
  "- [ ] Test bekerja.",
  "## Laporan gerbang",
  "Laporan bukan acceptance.",
].join("\n");

test.each(["\n", "\r\n"])("parsePhase menerima newline %j", (newline) => {
  const phase = parsePhase(source.replaceAll("\n", newline), "fixture.md");
  expect(phase).toEqual({
    num: "00",
    title: "Skeleton",
    tasks: [
      {
        id: "F00-T01",
        title: "CLI ringan",
        heading: "Task F00-T01 — CLI ringan",
        type: "feat",
        labels: ["os:windows", "spec-change"],
        deps: [],
        done: "- [ ] Help bekerja.",
      },
      {
        id: "F00-T02",
        title: "Harness",
        heading: "Task F00-T02 – Harness",
        type: "test",
        labels: [],
        deps: ["F00-T01", "F01-T03"],
        done: "- [ ] Test bekerja.",
      },
    ],
  });
});

test.each([
  ["Task F00-T01 — CLI ringan", "task-f00-t01--cli-ringan"],
  ["  Édit JSONC / 日本語!  ", "édit-jsonc--日本語"],
  ["Nama_berkas-v2.0", "nama_berkas-v20"],
])("githubSlug(%s)", (heading, slug) => {
  expect(githubSlug(heading)).toBe(slug);
});

test("issue memuat link spec dan acceptance tanpa menyalin langkah", () => {
  const [first, second] = parsePhase(source, "fixture.md").tasks;
  const specUrl = "https://example.invalid/spec.md";
  expect(issueTitle(first)).toBe("[F00-T01] CLI ringan");
  const body = issueBody(first, "00", specUrl, []);
  expect(body).toContain(
    "**Task:** `F00-T01` · **Phase:** F00 · **Type:** feat",
  );
  expect(body).toContain(
    `**Spec:** [Task F00-T01 — CLI ringan](${specUrl}#task-f00-t01--cli-ringan)`,
  );
  expect(body).toContain("**Depends on:** —");
  expect(body).toContain("### Acceptance criteria\n\n- [ ] Help bekerja.");
  expect(body).toEndWith("<!-- sync-issues: F00-T01 -->");
  expect(body).not.toContain("Detail implementasi");
  expect(body).not.toContain("Catatan bukan acceptance");
  expect(
    issueBody(second, "00", specUrl, ["#1 (F00-T01)", "F01-T03"]),
  ).toContain("**Depends on:** #1 (F00-T01), F01-T03");
});

test("English phase content produces an English issue with stable references", () => {
  const phase = parsePhase(
    [
      "# Fase 00 — Repository skeleton and validation harness",
      "## Task F00-T01 — Bootstrap the package and validation harness",
      "- **Type:** chore",
      "### Selesai bila",
      "- [ ] Linux and Windows checks pass.",
      "## Task F00-T02 — Measure native startup baselines on three operating systems",
      "- **Type:** spike",
      "- **Bergantung pada:** F00-T01",
      "### Selesai bila",
      "- [ ] Startup time and child-process RSS are measured repeatedly.",
    ].join("\r\n"),
    "english-phase.md",
  );
  const task = phase.tasks[1];
  expect(issueTitle(task)).toBe(
    "[F00-T02] Measure native startup baselines on three operating systems",
  );
  expect(task.deps).toEqual(["F00-T01"]);
  expect(
    issueBody(task, phase.num, "https://example.invalid/spec.md", [
      "#1 (F00-T01)",
    ]),
  ).toBe(
    [
      "**Task:** `F00-T02` · **Phase:** F00 · **Type:** spike",
      "**Spec:** [Task F00-T02 — Measure native startup baselines on three operating systems](https://example.invalid/spec.md#task-f00-t02--measure-native-startup-baselines-on-three-operating-systems)",
      "**Depends on:** #1 (F00-T01)",
      "",
      "### Acceptance criteria",
      "",
      "- [ ] Startup time and child-process RSS are measured repeatedly.",
      "",
      "---",
      "Files, implementation steps, and verification commands are documented in the spec. Change the spec through a documentation PR, then run `sync-issues --update`.",
      "<!-- sync-issues: F00-T02 -->",
    ].join("\n"),
  );
});

test.each([
  ["heading fase hilang", "", 'heading "# Fase NN — Judul" tidak ditemukan'],
  ["task hilang", "# Fase 00 — Skeleton", 'tidak ada heading "## Task'],
  ["fase salah", source.replace("# Fase 0", "# Fase 2"), "ID tidak cocok"],
  ["ID ganda", source.replace("F00-T02", "F00-T01"), "ID ganda"],
  [
    "type salah",
    source.replace("**Type:** feat", "**Type:** invalid"),
    "tidak valid",
  ],
  [
    "acceptance kosong",
    source.replace("- [ ] Help bekerja.", ""),
    "kosong atau hilang",
  ],
  [
    "dependensi hilang",
    source.replace("F00-T01, F01-T03", "F00-T98"),
    "dependensi F00-T98 tidak ada",
  ],
])("parsePhase menolak %s", (_name, input, diagnostic) => {
  const moduleUrl = new URL("../scripts/sync-issues.ts", import.meta.url).href;
  const result = Bun.spawnSync([
    process.execPath,
    "--eval",
    `import { parsePhase } from ${JSON.stringify(moduleUrl)};
     parsePhase(${JSON.stringify(input)}, "invalid.md");`,
  ]);
  expect(result.stdout.toString()).toBe("");
  expect(result.stderr.toString()).toStartWith("sync-issues: invalid.md:");
  expect(result.stderr.toString()).toContain(diagnostic);
  expect(result.exitCode).toBe(1);
});
