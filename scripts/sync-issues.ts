#!/usr/bin/env bun
/**
 * Buat atau perbarui satu GitHub issue per task dari docs/phases/fase-NN.md.
 *
 *   bun scripts/sync-issues.ts docs/phases/fase-06.md --dry-run   # cek format, tanpa memanggil gh
 *   bun scripts/sync-issues.ts docs/phases/fase-06.md             # buat issue yang belum ada
 *   bun scripts/sync-issues.ts docs/phases/fase-06.md --update    # + perbarui judul/isi issue yang masih terbuka
 *
 * Idempoten: issue dikenali lewat penanda <!-- sync-issues: FNN-TMM --> di body atau awalan [FNN-TMM] di judul.
 * Issue yang sudah tertutup tidak pernah diubah. Hanya memakai node:* sehingga jalan di Bun maupun Node.
 */
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { relative, resolve } from "node:path";

const TYPES = ["feat", "fix", "test", "docs", "perf", "spike", "chore"];

type Task = {
  id: string;
  title: string;
  heading: string;
  type: string;
  labels: string[];
  deps: string[];
  done: string;
};

type Phase = { num: string; title: string; tasks: Task[] };

type GhIssue = { number: number; title: string; state: string; body: string };

function fail(msg: string): never {
  process.stderr.write(`sync-issues: ${msg}\n`);
  process.exit(1);
}

export function githubSlug(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, "")
    .replace(/ /g, "-");
}

export function parsePhase(src: string, fileName: string): Phase {
  const text = src.replace(/\r\n/g, "\n");
  const h1 = text.match(/^# Fase (\d{1,2})\s*[—–-]\s*(.+)$/m);
  if (!h1) fail(`${fileName}: heading "# Fase NN — Judul" tidak ditemukan`);
  const num = h1[1].padStart(2, "0");
  const phaseTitle = h1[2].trim();

  // Abaikan komentar HTML (aturan template) supaya contoh di dalamnya tidak terbaca sebagai task.
  const body = text.replace(/<!--[\s\S]*?-->/g, "");
  const headRe = /^## (Task (F\d{2}-T\d{2})\s*[—–-]\s*(.+))$/gm;
  const heads: { idx: number; heading: string; id: string; title: string }[] = [];
  for (const m of body.matchAll(headRe)) {
    heads.push({ idx: m.index ?? 0, heading: m[1].trim(), id: m[2], title: m[3].trim() });
  }
  if (heads.length === 0) fail(`${fileName}: tidak ada heading "## Task FNN-TMM — Judul"`);

  const errors: string[] = [];
  const seen = new Set<string>();
  const tasks: Task[] = heads.map((h, i) => {
    const end = i + 1 < heads.length ? heads[i + 1].idx : nextH2(body, h.idx);
    const sec = body.slice(h.idx, end);
    if (!h.id.startsWith(`F${num}-`)) errors.push(`${h.id}: ID tidak cocok dengan Fase ${num}`);
    if (seen.has(h.id)) errors.push(`${h.id}: ID ganda`);
    seen.add(h.id);

    const type = (sec.match(/^- \*\*Type:\*\*\s*([a-z]+)/m)?.[1] ?? "").trim();
    if (!TYPES.includes(type)) errors.push(`${h.id}: Type "${type}" tidak valid (${TYPES.join(" | ")})`);

    const labelLine = sec.match(/^- \*\*Labels:\*\*\s*(.+)$/m)?.[1] ?? "";
    const labels = labelLine
      .split(",")
      .map((s) => s.trim().replace(/`/g, ""))
      .filter((s) => s && s !== "—" && s !== "-");

    const depLine = sec.match(/^- \*\*Bergantung pada:\*\*\s*(.+)$/m)?.[1] ?? "";
    const deps = [...depLine.matchAll(/F\d{2}-T\d{2}/g)].map((m) => m[0]);

    const doneM = sec.match(/^### Selesai bila\s*\n([\s\S]*?)(?=^#{2,3} |(?![\s\S]))/m);
    const done = (doneM?.[1] ?? "").trim();
    if (!done) errors.push(`${h.id}: bagian "### Selesai bila" kosong atau hilang`);

    return { id: h.id, title: h.title, heading: h.heading, type, labels, deps, done };
  });

  const ids = new Set(tasks.map((t) => t.id));
  for (const t of tasks) {
    for (const d of t.deps) {
      if (d.startsWith(`F${num}-`) && !ids.has(d)) errors.push(`${t.id}: dependensi ${d} tidak ada di file ini`);
    }
  }
  if (errors.length) fail(`${fileName}:\n  - ${errors.join("\n  - ")}`);
  return { num, title: phaseTitle, tasks };
}

function nextH2(text: string, from: number): number {
  const re = /^## /gm;
  re.lastIndex = from + 3;
  const m = re.exec(text);
  return m ? m.index : text.length;
}

export function issueTitle(t: Task): string {
  return `[${t.id}] ${t.title}`;
}

export function issueBody(t: Task, phaseNum: string, specUrl: string, depRefs: string[]): string {
  const deps = depRefs.length ? depRefs.join(", ") : "—";
  return [
    `**Task:** \`${t.id}\` · **Fase:** F${phaseNum} · **Type:** ${t.type}`,
    `**Spec:** [${t.heading}](${specUrl}#${githubSlug(t.heading)})`,
    `**Bergantung pada:** ${deps}`,
    "",
    "### Selesai bila",
    "",
    t.done,
    "",
    "---",
    "Files, langkah, dan perintah verifikasi ada di spec. Perubahan spec dilakukan lewat PR docs, lalu `sync-issues --update`.",
    `<!-- sync-issues: ${t.id} -->`,
  ].join("\n");
}

function gh(args: string[], input?: string): string {
  const r = spawnSync("gh", args, { input, encoding: "utf8" });
  if (r.error) fail(`gagal menjalankan gh: ${r.error.message}`);
  if (r.status !== 0) fail(`gh ${args.slice(0, 3).join(" ")} … gagal:\n${r.stderr}`);
  return r.stdout.trim();
}

function git(args: string[]): string {
  const r = spawnSync("git", args, { encoding: "utf8" });
  if (r.status !== 0) fail(`git ${args.join(" ")} gagal:\n${r.stderr}`);
  return r.stdout.trim();
}

function main(): void {
  const argv = process.argv.slice(2);
  const file = argv.find((a) => !a.startsWith("--"));
  const dryRun = argv.includes("--dry-run");
  const update = argv.includes("--update");
  if (!file) fail("pemakaian: sync-issues.ts <docs/phases/fase-NN.md> [--dry-run] [--update]");

  const phase = parsePhase(readFileSync(file, "utf8"), file);
  const phaseLabel = `phase:F${phase.num}`;

  if (dryRun) {
    process.stdout.write(`Fase ${phase.num} — ${phase.title}: ${phase.tasks.length} task (dry-run, gh tidak dipanggil)\n\n`);
    for (const t of phase.tasks) {
      const labels = [phaseLabel, `type:${t.type}`, ...t.labels].join(", ");
      const deps = t.deps.length ? ` ← ${t.deps.join(", ")}` : "";
      process.stdout.write(`  ${issueTitle(t)}\n      label: ${labels}${deps}\n`);
    }
    const sample = phase.tasks[0];
    process.stdout.write(`\nContoh body untuk ${sample.id}:\n\n`);
    process.stdout.write(issueBody(sample, phase.num, "https://github.com/OWNER/REPO/blob/main/" + file, sample.deps) + "\n");
    return;
  }

  const root = git(["rev-parse", "--show-toplevel"]);
  const relPath = relative(root, resolve(file)).split("\\").join("/");
  const repoUrl = gh(["repo", "view", "--json", "url", "--jq", ".url"]);
  const specUrl = `${repoUrl}/blob/main/${relPath}`;

  // Milestone: cari yang berawalan "FNN ", buat bila belum ada.
  const milestones = JSON.parse(gh(["api", "repos/{owner}/{repo}/milestones?state=all&per_page=100"])) as { title: string }[];
  let milestone = milestones.find((m) => m.title.startsWith(`F${phase.num} `))?.title;
  if (!milestone) {
    milestone = `F${phase.num} · ${phase.title}`;
    gh(["api", "repos/{owner}/{repo}/milestones", "-f", `title=${milestone}`]);
    process.stdout.write(`milestone dibuat: ${milestone}\n`);
  }

  // Label yang belum ada dibuat dengan warna netral.
  const existingLabels = new Set(
    (JSON.parse(gh(["label", "list", "--limit", "500", "--json", "name"])) as { name: string }[]).map((l) => l.name),
  );
  const wanted = new Set<string>([phaseLabel, ...phase.tasks.flatMap((t) => [`type:${t.type}`, ...t.labels])]);
  for (const l of wanted) {
    if (!existingLabels.has(l)) {
      gh(["label", "create", l, "--color", "ededed"]);
      process.stdout.write(`label dibuat: ${l}\n`);
    }
  }

  const existing = JSON.parse(
    gh(["issue", "list", "--label", phaseLabel, "--state", "all", "--limit", "500", "--json", "number,title,state,body"]),
  ) as GhIssue[];
  const byId = new Map<string, GhIssue>();
  for (const is of existing) {
    const id = is.body.match(/<!-- sync-issues: (F\d{2}-T\d{2}) -->/)?.[1] ?? is.title.match(/^\[(F\d{2}-T\d{2})\]/)?.[1];
    if (id) byId.set(id, is);
  }

  let created = 0;
  let updated = 0;
  let skipped = 0;
  for (const t of phase.tasks) {
    const depRefs = t.deps.map((d) => (byId.has(d) ? `#${byId.get(d)!.number} (${d})` : d));
    const title = issueTitle(t);
    const body = issueBody(t, phase.num, specUrl, depRefs);
    const found = byId.get(t.id);

    if (!found) {
      const args = ["issue", "create", "--title", title, "--body-file", "-", "--milestone", milestone, "--label", phaseLabel, "--label", `type:${t.type}`];
      for (const l of t.labels) args.push("--label", l);
      const url = gh(args, body);
      const number = Number(url.split("/").pop());
      byId.set(t.id, { number, title, state: "OPEN", body });
      process.stdout.write(`dibuat     #${number} ${title}\n`);
      created++;
    } else if (update && found.state === "OPEN" && (found.title !== title || found.body.trim() !== body.trim())) {
      gh(["issue", "edit", String(found.number), "--title", title, "--body-file", "-"], body);
      process.stdout.write(`diperbarui #${found.number} ${title}\n`);
      updated++;
    } else {
      process.stdout.write(`dilewati   #${found.number} ${title} (${found.state.toLowerCase()})\n`);
      skipped++;
    }
  }
  process.stdout.write(`\n${created} dibuat, ${updated} diperbarui, ${skipped} dilewati. Milestone: ${milestone}\n`);
  if (!update && phase.tasks.some((t) => t.deps.some((d) => !d.startsWith(`F${phase.num}-`)))) {
    process.stdout.write("Catatan: dependensi lintas fase ditulis sebagai ID, bukan nomor issue.\n");
  }
}

const isMain = process.argv[1] && resolve(process.argv[1]).replace(/\\/g, "/").endsWith("scripts/sync-issues.ts");
if (isMain) main();
