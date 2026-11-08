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
    "**Task:** `F00-T01` · **Fase:** F00 · **Type:** feat",
  );
  expect(body).toContain(
    `**Spec:** [Task F00-T01 — CLI ringan](${specUrl}#task-f00-t01--cli-ringan)`,
  );
  expect(body).toContain("**Bergantung pada:** —");
  expect(body).toContain("### Selesai bila\n\n- [ ] Help bekerja.");
  expect(body).toEndWith("<!-- sync-issues: F00-T01 -->");
  expect(body).not.toContain("Detail implementasi");
  expect(body).not.toContain("Catatan bukan acceptance");
  expect(
    issueBody(second, "00", specUrl, ["#1 (F00-T01)", "F01-T03"]),
  ).toContain("**Bergantung pada:** #1 (F00-T01), F01-T03");
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
