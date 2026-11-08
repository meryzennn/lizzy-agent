# Fase 00 Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menyelesaikan Fase 0: skeleton CLI Bun-only yang bisa dibangun, config dan shell discovery yang teruji, mock dua protokol, serta keputusan renderer dan gerbang performa berdasarkan pengukuran.

**Architecture:** Entry CLI menyelesaikan flag informasi sebelum mengimpor aplikasi. Modul aplikasi memuat config dan platform; semua akses OS produksi berada di `src/platform/`. Mock dan spike terpisah dari graf produksi; gerbang perf membandingkan binary aplikasi dengan baseline workload dan lingkungan yang sama.

**Tech Stack:** Bun `1.4.2` sebagai pin awal yang diusulkan, TypeScript strict, zod, `bun:test`, Biome; pi-tui hanya di paket spike sampai keputusan ADR-003 diterima.

**Spec:** [`docs/phases/fase-00.md`](../../phases/fase-00.md), [`docs/PLAN.html`](../../PLAN.html), [`docs/PLAN.md`](../../PLAN.md) bagian R/C/D Fase 0, dan [`docs/adr/`](../../adr/). Baca spec serta plan ini bersama.

## Global Constraints

Kutipan berikut mempertahankan nilai dan keputusan sumber:

- ADR-001: "Proyek ini Bun-only. API khusus Bun boleh dipakai. Akses OS tetap lewat `src/platform/` supaya mudah diuji dan diganti."
- ADR-002: "Tidak ada `ai`, `@ai-sdk/*`, atau SDK provider di dependencies."
- ADR-003: "TUI memakai renderer diferensial: komponen `render(width): string[]`, diff baris, hanya rentang yang berubah dicat ulang, dibungkus CSI 2026."
- ADR-004: "Resolusi path: config → lokasi instal Git umum → `PATH`."
- ADR-005: "Config global dan proyek memakai JSONC (JSON dengan komentar), divalidasi zod, dengan field `version` untuk migrasi. Tema tetap JSON murni."
- ADR-006: "Fase 0 mengukur baseline hello-world di Linux, Windows, dan macOS ke `docs/perf/baseline.json`."
- ADR-006: "regresi >20% dari baseline = merah."
- ADR-006: "Memperbarui baseline butuh persetujuan user di PR berlabel `spec-change`."
- CLAUDE.md: "stdout hanya untuk output hasil/terstruktur; semua log dan diagnostik ke stderr."
- CLAUDE.md: "`bun test` tidak boleh menyentuh jaringan atau provider asli; pakai mock provider server." Loopback milik test adalah transport mock yang dimaksud; tidak ada request internet dalam suite.
- Template fase: "Task ≤ ~400 baris diff. Pecah bila lebih besar." "Spike: type spike, keluarannya dokumen/angka, bukan kode produksi."
- Workflow: satu issue, branch, dan PR per task; user melakukan merge, pengaturan proteksi branch, penutupan milestone dan rilis.

---

## Batas pekerjaan dan prasyarat eksekusi

Ini rencana implementasi, bukan bukti implementasi. Pada 8 November 2026 hanya paket starter yang ada, tanpa Git repository atau Bun yang bisa dijalankan. Pekerjaan perencanaan hanya menambah dua Markdown ini.

Sebelum task kode: runtime Bun dengan versi pin tersedia, starter menjadi repository Git yang benar, spec disetujui dan issue dibuat. Gunakan prosedur setup awal di `README-KIT.md` untuk repo baru; jangan menebak owner, visibilitas atau remote. Pengecualian commit pertama starter ke `main` hanya berlaku pada setup awal tersebut. Setelah itu gunakan branch task. Jika workspace sudah terisolasi, gunakan worktree yang tersedia; jika perlu isolasi baru, ikuti `superpowers:using-git-worktrees` saat eksekusi.

Penambahan zod sudah merupakan pilihan ADR-005, tetapi alasan dependency dan dampak perf tetap ditulis di issue/PR. Paket pi-tui terisolasi sebagai dependency development spike. Lisensi proyek belum dipilih; `private: true` mencegah publikasi paket npm tidak sengaja dan tidak menetapkan lisensi atas nama user.

Setiap blok kode di bawah adalah isi file yang disebut atau perubahan presisi terhadapnya. Jalankan formatter setelah menulis kode. Pada setiap task: jalankan test khusus dahulu, lalu `check`; setelah T09 aktif jalankan `perf` juga pada lingkungan yang punya baseline matching. Tidak menurunkan test, mengubah baseline otomatis, atau meneruskan task berikutnya sebelum PR task sekarang direview sesuai workflow.

Perintah contoh memakai `rtk`, sesuai instruksi workspace. Isi `package.json` dan job GitHub Actions memanggil Bun langsung: RTK bukan dependency produk maupun runner CI.

## Peta file dan kontrak

| Lokasi | Tanggung jawab |
|---|---|
| `src/cli.ts` | Parse argumen, help/version, lazy import dan batas error CLI |
| `src/app.ts` | Startup skeleton; menyambungkan config dan shell; probe idle internal |
| `src/config.ts` | Parse/validasi JSONC dan merge field F0 |
| `src/platform/config.ts` | Lokasi dan pembacaan config global/proyek |
| `src/platform/shell.ts` | Penemuan dan identifikasi Git Bash |
| `src/platform/process.ts` | Subprocess tanpa shell, metadata platform dan ukuran artefak |
| `test/helpers/mock-provider.ts` | HTTP mock loopback dengan lifecycle per test |
| `test/fixtures/providers/*` | Payload wire sintetis JSON dan SSE |
| `scripts/build.ts` | Binary native dari entry CLI |
| `scripts/measure-perf.ts` | Sampel binary anak, hasil mesin yang dapat diaudit |
| `scripts/perf.ts` | Validasi baseline dan gate >20% |
| `spikes/boot.ts` | Lantai hello-world Bun compiled |
| `spikes/renderer/*` | Dua backend eksperimen, tidak diimpor aplikasi |
| `docs/perf/*`, ADR-003/006 | Data mentah/keputusan/hasil gate |

Urutan aman: T01 → T02 → T03 → T04 → T05 → T06 → T07 → T08 → T09 → T10. T03 dan T07 secara teknis independen setelah T01, tetapi workflow proyek tetap satu task implementasi aktif. Pembacaan/review read-only dapat paralel.

## Task 1: F00-T01 — Bootstrap paket dan harness

**Files:** Create `package.json`, `bun.lock`, `.bun-version`, `tsconfig.json`, `biome.json`, `.gitignore`, `test/sync-issues.test.ts`. Modify `.github/workflows/ci.yml:23`, `scripts/sync-issues.ts` hanya bila formatting diperlukan.

**Interfaces:** Consumes ekspor `parsePhase(src: string, fileName: string)`, `githubSlug(text: string)`, `issueTitle(task)`, `issueBody(task, phaseNum, specUrl, depRefs)` dari skrip existing. Produces `bun run check` = typecheck + lint + test dan toolchain pin yang sama bagi semua task.

- [ ] **Step 1: Tambahkan test kontrak skrip existing.** Tidak perlu membuat parser baru. Isi `test/sync-issues.test.ts`:

```ts
import { expect, test } from "bun:test";
import { githubSlug, issueBody, issueTitle, parsePhase } from "../scripts/sync-issues";

test("spec menghasilkan issue yang menautkan task dan acceptance", () => {
  const source = [
    "# Fase 00 — Skeleton",
    "## Task F00-T01 — CLI ringan",
    "- **Type:** feat",
    "- **Bergantung pada:** —",
    "### Selesai bila",
    "- [ ] Help bekerja.",
  ].join("\r\n");
  const phase = parsePhase(source, "fixture.md");
  const task = phase.tasks[0];
  expect(phase.num).toBe("00");
  expect(issueTitle(task)).toBe("[F00-T01] CLI ringan");
  expect(githubSlug(task.heading)).toBe("task-f00-t01--cli-ringan");
  const body = issueBody(task, "00", "https://example.invalid/spec.md", []);
  expect(body).toContain("#task-f00-t01--cli-ringan");
  expect(body).toContain("<!-- sync-issues: F00-T01 -->");
  expect(body).toContain("- [ ] Help bekerja.");
});
```

- [ ] **Step 2: Buktikan harness belum tersedia.** `rtk bun run check` gagal karena `package.json`/skrip belum ada. Test fungsi existing sendiri boleh langsung lulus; jangan merusak fungsi untuk membuat red palsu.
- [ ] **Step 3: Buat konfigurasi paket.** `package.json`:

```json
{
  "name": "lizzy-agent",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "engines": { "bun": "1.4.2" },
  "scripts": {
    "test": "bun test test",
    "typecheck": "tsc --noEmit",
    "lint": "biome check src scripts test",
    "format": "biome check --write src scripts test",
    "check": "bun run typecheck && bun run lint && bun run test"
  }
}
```

`src/` tidak ada sampai T02; untuk T01 gunakan `biome check scripts test` dan `biome check --write scripts test`, lalu tambahkan `src` di T02 ketika folder itu dibuat. `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "Preserve",
    "moduleResolution": "Bundler",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "types": ["bun"]
  },
  "include": ["src/**/*.ts", "scripts/**/*.ts", "test/**/*.ts"]
}
```

`biome.json`:

```json
{
  "formatter": { "enabled": true, "indentStyle": "space", "indentWidth": 2 },
  "linter": { "enabled": true, "rules": { "recommended": true } }
}
```

`.bun-version`: `1.4.2` diikuti newline. `.gitignore`:

```gitignore
node_modules/
dist/
coverage/
.env
.env.*
.lizzy/
```

- [ ] **Step 4: Instal hanya tooling dev dan hasilkan lockfile.** `rtk bun add --dev --exact typescript @types/bun @biomejs/biome`. Commit hasil resolusi versi persis dan `bun.lock`; jangan menulis lockfile manual. Di CI ganti `bun-version: latest` dengan `bun-version-file: .bun-version`. Pertahankan check Windows/Linux. Jalankan formatter pada `scripts/sync-issues.ts` bila Biome meminta; perubahan ini sebatas style, tidak mengubah parser. Jika ada diagnostic perilaku, selesaikan terpisah, jangan mematikan lint untuk seluruh skrip.
- [ ] **Step 5: Verifikasi.** `rtk bun install --frozen-lockfile`, `rtk bun test test/sync-issues.test.ts`, `rtk bun run check` → semuanya exit 0. Check harus benar-benar menjalankan tiga alat.
- [ ] **Step 6: Commit.** Stage hanya file task; judul `chore(f00): bootstrap Bun dan harness [F00-T01]`. Ambil nomor issue aktual F00-T01, lalu tulis `Refs #` diikuti nomor tersebut sebagai baris terakhir body. Jangan memakai nomor issue karangan atau stage seluruh workspace.

## Task 2: F00-T02 — Spike baseline boot native

**Files:** Create `spikes/boot.ts`, `src/platform/process.ts`, `scripts/measure-perf.ts`, `test/measure-perf.test.ts`, `.github/workflows/baseline.yml`, `docs/perf/measurement.md`. Modify `package.json` lint/format untuk menyertakan `src`.

**Interfaces:** Produces `run(command: string[], env?: NodeJS.ProcessEnv, timeoutMs?: number): string`, `artifactBytes(path: string): number`, `platformKey(runner: string): string`, `measure(command: string[], artifact: string, workload: string, runner: string): Measurement`. `Measurement` memuat schemaVersion, key, bun, workload, metrics dan raw samples, digunakan T08/T09.

- [ ] **Step 1: Tambahkan test pengukur.** `test/measure-perf.test.ts`:

```ts
import { expect, test } from "bun:test";
import { measure } from "../scripts/measure-perf";

test("mengukur anak dan mempertahankan raw samples", () => {
  const result = measure([process.execPath, "spikes/boot.ts"], "spikes/boot.ts", "hello-source-test", "test");
  expect(result.workload).toBe("hello-source-test");
  expect(result.samples.versionMs).toHaveLength(15);
  expect(result.samples.idleRssBytes).toHaveLength(5);
  expect(result.metrics.idleRssBytes).toBeGreaterThan(0);
  expect(result.metrics.binaryBytes).toBeGreaterThan(0);
});
```

- [ ] **Step 2: Jalankan red.** `rtk bun test test/measure-perf.test.ts` → gagal karena modul measure belum ada.
- [ ] **Step 3: Buat boundary subprocess.** `src/platform/process.ts`:

```ts
import { spawnSync } from "node:child_process";
import { statSync } from "node:fs";

export function run(command: string[], env: NodeJS.ProcessEnv = process.env, timeoutMs = 10_000): string {
  const result = spawnSync(command[0], command.slice(1), {
    env, encoding: "utf8", timeout: timeoutMs, windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.error || result.status !== 0) {
    throw new Error(`Proses ${command[0]} gagal: ${result.error?.message ?? result.stderr}`);
  }
  return result.stdout;
}

export const artifactBytes = (path: string): number => statSync(path).size;
export const platformKey = (runner: string): string => `${process.platform}-${process.arch}-${runner}`;
```

`spikes/boot.ts`:

```ts
if (process.argv.includes("--version")) {
  process.stdout.write("hello 0.0.0\n");
} else if (process.env.LIZZY_PERF_PROBE === "1") {
  await Bun.sleep(200);
  process.stdout.write(`${JSON.stringify({ rss: process.memoryUsage().rss })}\n`);
} else {
  process.stdout.write("hello\n");
}
export {};
```

- [ ] **Step 4: Tulis pengukur.** `scripts/measure-perf.ts`:

```ts
import { artifactBytes, platformKey, run } from "../src/platform/process";

export type Metrics = { versionMs: number; idleRssBytes: number; binaryBytes: number };
export type Measurement = {
  schemaVersion: 1; key: string; bun: string; workload: string;
  metrics: Metrics;
  samples: { versionMs: number[]; idleRssBytes: number[] };
};
const median = (values: number[]): number => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

export function measure(command: string[], artifact: string, workload: string, runner: string): Measurement {
  const env = { ...process.env, LIZZY_PERF_PROBE: "0" };
  for (let i = 0; i < 3; i++) run([...command, "--version"], env);
  const versionMs = Array.from({ length: 15 }, () => {
    const start = performance.now();
    run([...command, "--version"], env);
    return performance.now() - start;
  });
  const idleRssBytes = Array.from({ length: 5 }, () => {
    const value: unknown = JSON.parse(run(command, { ...env, LIZZY_PERF_PROBE: "1" }));
    if (!value || typeof value !== "object" || !("rss" in value) ||
      typeof value.rss !== "number" || !Number.isFinite(value.rss) || value.rss <= 0) {
      throw new Error("Probe anak harus menghasilkan rss positif dalam byte.");
    }
    return value.rss;
  });
  return {
    schemaVersion: 1, key: platformKey(runner), bun: Bun.version, workload,
    metrics: { versionMs: median(versionMs), idleRssBytes: median(idleRssBytes), binaryBytes: artifactBytes(artifact) },
    samples: { versionMs, idleRssBytes },
  };
}

if (import.meta.main) {
  const [artifact, workload] = process.argv.slice(2);
  if (!artifact || !workload) throw new Error("Pemakaian: measure-perf.ts <binary> <workload>");
  const result = measure([artifact], artifact, workload, process.env.LIZZY_PERF_RUNNER ?? "local");
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
```

- [ ] **Step 5: Buat workflow pengumpulan awal.** `.github/workflows/baseline.yml` berikut memakai shell Bun sehingga path/output sama pada tiga OS:

```yaml
name: baseline
on:
  workflow_dispatch:
jobs:
  measure:
    strategy:
      fail-fast: false
      matrix:
        os: [ubuntu-latest, windows-latest, macos-latest]
    runs-on: ${{ matrix.os }}
    env:
      LIZZY_PERF_RUNNER: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version-file: .bun-version
      - run: bun install --frozen-lockfile
      - name: Compile and measure hello
        shell: bun {0}
        run: |
          import { mkdir } from "node:fs/promises";
          import { join, resolve } from "node:path";
          import { measure } from "./scripts/measure-perf.ts";
          import { run } from "./src/platform/process.ts";
          await mkdir("dist", { recursive: true });
          const binary = resolve(join("dist", process.platform === "win32" ? "hello.exe" : "hello"));
          run([process.execPath, "build", "--compile", "spikes/boot.ts", "--outfile", binary], process.env, 120_000);
          await Bun.write("dist/hello-measurement.json", JSON.stringify(measure([binary], binary, "hello-v1", process.env.LIZZY_PERF_RUNNER), null, 2));
          await Bun.write("dist/environment.json", JSON.stringify({ bun: Bun.version, os: process.platform, arch: process.arch, image: process.env.ImageOS, imageVersion: process.env.ImageVersion, commit: process.env.GITHUB_SHA }, null, 2));
      - uses: actions/upload-artifact@v4
        with:
          name: baseline-${{ matrix.os }}
          path: |
            dist/*measurement.json
            dist/environment.json
```

- [ ] **Step 6: Verifikasi dan rekam metode.** `rtk bun test test/measure-perf.test.ts`, `rtk bun run check` → exit 0. Jalankan workflow setelah branch tersedia; simpan URL run dan artifacts. Isi `docs/perf/measurement.md` dengan metode: 3 warmup + 15 subprocess startup, median; 5 subprocess idle, sampling anak setelah 200 ms; byte artefak; exact Bun, OS/arch, runner/image, commit. Ini startup proses baru dengan cache OS hangat, bukan pengukuran boot mesin dingin atau latensi TUI. Batas binary diputuskan di T09 setelah aplikasi diukur juga.
- [ ] **Step 7: Commit.** `perf(f00): ukur baseline boot native [F00-T02]`, body `Refs #` dengan issue aktual. Tidak mengisi `baseline.json` dengan angka dari mesin lain atau angka contoh.

## Task 3: F00-T03 — Spike renderer

**Files:** Create `spikes/renderer/package.json`, `spikes/renderer/bun.lock`, `spikes/renderer/compare.ts`, `spikes/renderer/compare.test.ts`, `spikes/renderer/minimal.ts`, `spikes/renderer/pi.ts`, `spikes/renderer/minimal-entry.ts`, `spikes/renderer/pi-entry.ts`, `docs/perf/renderer.md`. Modify `docs/adr/003-renderer-tui.md:22`.

**Interfaces:** Consumes API pi-tui yang diverifikasi saat spike; produces dua backend `runDemo(kind: "pi" | "minimal"): Promise<void>`, fixture identik, hasil ukuran/latensi dan keputusan ADR. Tidak mengekspor backend ke `src/`.

- [ ] **Step 1: Isolasi paket percobaan.** `spikes/renderer/package.json`:

```json
{ "name": "lizzy-renderer-spike", "private": true, "type": "module" }
```

Dari direktori itu jalankan `rtk bun add --dev --exact @earendil-works/pi-tui@1.5.0`. Versi/API diperiksa pada upstream commit `e49b1495045f06643a7cc4c93330fabc2ab37ce4`. Paket berlisensi MIT, mendeklarasikan Node >=22.19 dan membawa optional native helpers: kompatibilitas compiled Bun harus dibuktikan spike. Commit lockfile paket spike; dependency tidak ditambahkan ke root `dependencies`.

- [ ] **Step 2: Tulis test algoritme pembanding.** `spikes/renderer/compare.test.ts`:

```ts
import { expect, test } from "bun:test";
import { diffFrame, containsEcho } from "./compare";
test("hanya menggambar baris berubah dalam frame tersinkron", () => {
  expect(diffFrame(["a", "b"], ["a", "c"])).toBe("\x1b[?2026h\x1b[2;1H\x1b[2Kc\x1b[?2026l");
  expect(diffFrame(["a"], ["a"])).toBe("");
  expect(diffFrame(["a", "b"], ["a"])).toContain("\x1b[2;1H\x1b[2K");
});
test("write streaming tidak dianggap echo ketikan", () => {
  expect(containsEcho("stream token", "abc")).toBe(false);
  expect(containsEcho("\x1b[32m> abc\x1b[0m", "abc")).toBe(true);
});
```

- [ ] **Step 3: Jalankan red.** `rtk bun test spikes/renderer/compare.test.ts` → modul/fungsi belum tersedia.
- [ ] **Step 4: Buat prototipe dua backend.** Isi `spikes/renderer/compare.ts`:

```ts
export function diffFrame(previous: string[], next: string[]): string {
  let output = "";
  for (let i = 0; i < Math.max(previous.length, next.length); i++) {
    if (previous[i] !== next[i]) output += `\x1b[${i + 1};1H\x1b[2K${next[i] ?? ""}`;
  }
  return output ? `\x1b[?2026h${output}\x1b[?2026l` : "";
}

export async function runDemo(kind: "pi" | "minimal"): Promise<void> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) throw new Error("Jalankan spike di terminal interaktif native.");
  const { Input, ProcessTerminal, Text, TuiMainScreen } = await import("@earendil-works/pi-tui");
  let transcript = "";
  let typed = "";
  let previous: string[] = [];
  let ticks = 0;
  const times: number[] = [];
  const tui = kind === "pi" ? new TuiMainScreen(new ProcessTerminal()) : undefined;
  const text = new Text("", 0, 0);
  const input = new Input({ prompt: "> " });
  const pending: Array<{ at: number; expected: string }> = [];
  let frame = "";
  const originalWrite = process.stdout.write;
  const rawInput = (data: Buffer | string) => {
    const key = data.toString();
    if (/^[a-z]$/.test(key)) {
      frame = "";
      pending.push({ at: performance.now(), expected: (tui ? input.getValue() : typed) + key });
    }
  };
  process.stdin.prependListener("data", rawInput);
  process.stdout.write = new Proxy(originalWrite, { apply(target, receiver, args) {
    const result = Reflect.apply(target, receiver, args);
    const chunk = args[0];
    frame = (frame + (typeof chunk === "string" ? chunk : Buffer.isBuffer(chunk) ? chunk.toString() : "")).slice(-32768);
    for (let i = pending.length - 1; i >= 0; i--) {
      if (containsEcho(frame, pending[i].expected)) times.push(performance.now() - pending.splice(i, 1)[0].at);
    }
    return result;
  } });
  const paint = () => {
    const width = Math.max(1, (process.stdout.columns || 80) - 1);
    if (tui) { text.setText(transcript.slice(-width)); tui.requestRender(); }
    else {
      const next = [transcript.slice(-width), `> ${typed}`.slice(-width)];
      process.stdout.write(diffFrame(previous, next));
      previous = next;
    }
  };
  await new Promise<void>((resolve) => {
    const stop = () => { clearInterval(timer); if (tui) tui.stop(); else { process.stdin.off("data", onData); process.stdin.setRawMode(false); process.stdin.pause(); process.stdout.write("\x1b[?1049l"); } process.stdin.off("data", rawInput); process.stdout.write = originalWrite; resolve(); };
    const onData = (data: Buffer) => {
      if (data.includes(3) || data.includes(27)) { stop(); return; }
      for (const ch of data.toString()) {
        if (ch === "\r") { transcript = `${transcript} ${typed}`; typed = ""; }
        else if (ch === "\x7f") typed = typed.slice(0, -1);
        else if (ch >= " " && ch <= "~") typed += ch;
      }
      paint();
    };
    if (tui) {
      tui.addChild(text); tui.addChild(input); tui.setFocus(input);
      input.onSubmit = (value: string) => { transcript += ` ${value}`; input.setValue(""); paint(); };
      tui.addInputListener((data: string) => { if (data === "\x03" || data === "\x1b") { stop(); return { consume: true }; } return undefined; });
      tui.start();
    } else {
      process.stdout.write("\x1b[?1049h\x1b[2J");
      process.stdin.setRawMode(true); process.stdin.resume(); process.stdin.on("data", onData);
    }
    const timer = setInterval(() => { transcript = `${transcript} token-${ticks++}`.slice(-4096); paint(); }, 34);
    paint();
  });
  times.sort((a, b) => a - b);
  process.stderr.write(`${JSON.stringify({ kind, samplesMs: times, inputToWriteP95Ms: times[Math.floor(times.length * 0.95)] ?? null, unanswered: pending.length })}\n`);
}
export function containsEcho(frame: string, input: string): boolean {
  return frame.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, "").includes(`> ${input}`);
}
if (import.meta.main) {
  const kind = process.argv[2];
  if (kind !== "pi" && kind !== "minimal") throw new Error("Pilih pi atau minimal.");
  await runDemo(kind);
}
```

Ini fixture ASCII kecil, bukan editor produksi. Observer yang sama mengukur **raw-input-ke-write-yang-memuat-echo**, termasuk buffering input; paint token streaming saja tidak dihitung. Hasil bukan waktu cat fisik layar. Gunakan terminal native 120 kolom, masukkan satu huruf kecil per event, submit setelah 50 huruf dan kumpulkan minimal 100 sampel per backend; `unanswered` harus nol. Gerbang PTY produksi <16 ms p95 tetap Fase 9. Jika optional helper pi gagal dalam compiled Bun, catat sebagai hasil perbandingan, jangan menganggap Node compatibility otomatis berlaku untuk Bun.

- [ ] **Step 5: Uji dan ukur kedua backend.** Test di atas harus lulus. Dari root: `rtk bun spikes/renderer/compare.ts minimal`, lalu `rtk bun spikes/renderer/compare.ts pi`; ketik, submit, stream, resize terminal dan keluar dengan Esc/Ctrl+C. Catat platform, terminal, ukuran viewport, perilaku restore terminal dan hasil resize. Kegagalan resize/input adalah data spike, bukan fitur yang disembunyikan.
- [ ] **Step 6: Ukur bundle secara terpisah.** Build dua entry yang hanya mengimpor backend masing-masing diperlukan agar ukuran library tidak ikut membengkakkan hasil minimal. Sebelum pengukuran pisahkan fungsi backend dari `compare.ts` menjadi `minimal.ts` dan `pi.ts`, masing-masing mengekspor `runDemo(): Promise<void>`, pertahankan `diffFrame` di `compare.ts`, dan ubah dispatcher menjadi dynamic import berdasarkan kind. Buat entry `spikes/renderer/minimal-entry.ts` dengan `import { runDemo } from "./minimal"; await runDemo();` serta `pi-entry.ts` dengan import `./pi`. Jalankan `rtk bun build spikes/renderer/minimal-entry.ts --target=bun --outfile dist/minimal-spike.js` dan pasangan `pi-entry.ts` → `dist/pi-spike.js`. Ukur byte `Bun.file(...).size`, lalu compiled binary kedua entry di platform yang sama. Semua file tambahan ini hanya bagian paket spike; masukkan ke daftar file PR.
- [ ] **Step 7: Tulis hasil dan keputusan.** `docs/perf/renderer.md` berisi versi paket/license, kedua build command dan byte, test terminal Windows/Linux, metrik latensi dengan definisinya, kekurangan teramati, pilihan dan alasan. Perbarui hanya bagian hasil spike ADR-003. Jika tidak ada bukti cukup untuk memilih, catat hasil parsial dan status keputusan belum diterima; task belum memenuhi acceptance, jangan memindahkan TUI produksi ke F0 untuk menutupnya.
- [ ] **Step 8: Commit.** `docs(f00): hasil spike renderer [F00-T03]`, `Refs #` nomor issue aktual; PR diberi `spec-change` bila keputusan ADR berubah.

## Task 4: F00-T04 — CLI ringan dan build

**Files:** Create `src/cli.ts`, `src/app.ts`, `scripts/build.ts`, `test/cli.test.ts`. Modify `package.json`, `.github/workflows/ci.yml`.

**Interfaces:** Consumes `run` platform T02. Produces `main(args: string[]): Promise<number>`, `start(): Promise<number>`, `agent --help`, `agent --version`, exit 2 untuk input invalid, exit 1 untuk startup error.

- [ ] **Step 1: Tulis `test/cli.test.ts`.**

```ts
import { expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const invoke = (args: string[], env = process.env, cwd?: string) => spawnSync(process.execPath, [resolve("src/cli.ts"), ...args], { encoding: "utf8", env, cwd, windowsHide: true });
test.each(["--help", "--version"])("flag %s bersih tanpa startup", (flag) => {
  const result = invoke([flag], { ...process.env, LIZZY_PERF_PROBE: "0" });
  expect(result.status).toBe(0);
  expect(result.stdout.length).toBeGreaterThan(0);
  expect(result.stderr).toBe("");
});
test("argumen asing ditolak tanpa hasil stdout", () => {
  const result = invoke(["--unknown"]);
  expect(result.status).toBe(2);
  expect(result.stdout).toBe("");
  expect(result.stderr).toContain("--help");
});
```

- [ ] **Step 2: Red.** `rtk bun test test/cli.test.ts` → entry belum ada.
- [ ] **Step 3: Implementasikan entry.** `src/cli.ts`:

```ts
import { parseArgs } from "node:util";
import { version } from "../package.json";

export async function main(args: string[]): Promise<number> {
  let flags: { help?: boolean; version?: boolean };
  try {
    flags = parseArgs({ args, strict: true, allowPositionals: false, options: {
      help: { type: "boolean", short: "h" }, version: { type: "boolean", short: "v" },
    } }).values;
  } catch {
    process.stderr.write("Argumen tidak dikenal. Jalankan agent --help.\n");
    return 2;
  }
  if (flags.help) { process.stdout.write("Pemakaian: agent [--help | --version]\nSkeleton CLI; model dan loop tersedia pada fase berikutnya.\n"); return 0; }
  if (flags.version) { process.stdout.write(`${version}\n`); return 0; }
  const { start } = await import("./app");
  return start();
}
if (import.meta.main) {
  try { process.exitCode = await main(process.argv.slice(2)); }
  catch (error) { process.stderr.write(`${error instanceof Error ? error.message : "Startup gagal; periksa instalasi dan config."}\n`); process.exitCode = 1; }
}
```

`src/app.ts`:

```ts
export async function start(): Promise<number> {
  process.stderr.write("Skeleton siap. Pemanggilan model belum tersedia di Fase 0.\n");
  return 0;
}
```

`scripts/build.ts` (skrip build mengoordinasikan OS; proses child tetap lewat platform):

```ts
import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { run } from "../src/platform/process";

mkdirSync("dist", { recursive: true });
const output = resolve(join("dist", process.platform === "win32" ? "agent.exe" : "agent"));
run([process.execPath, "build", "--compile", "src/cli.ts", "--outfile", output], process.env, 120_000);
process.stdout.write(`${output}\n`);
```

Build menggunakan timeout 120 detik, probe tetap 10 detik. Tambahkan script `"build": "bun scripts/build.ts"` ke package. Import fixture filesystem pada test CLI baru diperlukan T05; sebelum itu jangan menambah import yang belum dipakai agar lint T04 tetap bersih.

- [ ] **Step 4: Green source dan binary.** `rtk bun test test/cli.test.ts`, `rtk bun run build`, lalu Windows `rtk proxy .\dist\agent.exe --help` dan `--version`; Linux `rtk proxy ./dist/agent --help` dan `--version`. Tambahkan langkah berikut pada job `check` setelah `bun run check`:

```yaml
      - run: bun run build
      - name: Binary smoke
        shell: bun {0}
        run: |
          import assert from "node:assert/strict";
          import { join, resolve } from "node:path";
          import { version } from "./package.json";
          import { run } from "./src/platform/process.ts";
          const binary = resolve(join("dist", process.platform === "win32" ? "agent.exe" : "agent"));
          assert.match(run([binary, "--help"]), /Pemakaian/);
          assert.equal(run([binary, "--version"]).trim(), version);
```
- [ ] **Step 5: Commit.** `feat(f00): entry CLI ringan dan binary [F00-T04]`, body `Refs #` issue aktual, setelah `rtk bun run check` hijau.

## Task 5: F00-T05 — Config JSONC

**Files:** Create `src/config.ts`, `src/platform/config.ts`, `test/config.test.ts`. Modify `src/app.ts`, `package.json`, `bun.lock`.

**Interfaces:** Produces `parseConfig(text: string, label: string): ConfigLayer`, `mergeConfig(global: ConfigLayer, project: ConfigLayer): Config`, `loadConfig(cwd?: string, home?: string): Promise<Config>`. `Config = { version: 1; shell: { bash?: string } }`; `ConfigLayer` memiliki kedua field opsional. Lokasi global `~/.lizzy/config.jsonc`, proyek `<cwd>/.lizzy/config.jsonc` tanpa pencarian ancestor F0.

- [ ] **Step 1: Tulis test config.** `test/config.test.ts`:

```ts
import { expect, test } from "bun:test";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mergeConfig, parseConfig } from "../src/config";
import { loadConfig } from "../src/platform/config";

test("JSONC valid, empty valid, dan proyek tidak menghapus global lewat default", () => {
  const global = parseConfig('\ufeff{\r\n// shell\r\n"shell":{"bash":"C:\\\\Git\\\\bin\\\\bash.exe",},}', "global");
  expect(mergeConfig(global, {})).toEqual({ version: 1, shell: global.shell });
  expect(mergeConfig({}, {})).toEqual({ version: 1, shell: {} });
  expect(mergeConfig(global, { shell: { bash: "D:\\Git\\bin\\bash.exe" } }).shell.bash).toBe("D:\\Git\\bin\\bash.exe");
});
test.each(['{"version":2}', '{"unknown":true}', '{"shell":{"bash":42}}', '{"secret":"FAKE_SECRET_NEVER_REAL",']) ("invalid config ditolak tanpa nilai rahasia", (source) => {
  try { parseConfig(source, "config.jsonc"); throw new Error("test expected rejection"); }
  catch (error) {
    expect(String(error)).toContain("config.jsonc");
    expect(String(error)).not.toContain("FAKE_SECRET_NEVER_REAL");
  }
});
test("load global dan proyek terisolasi; missing valid, malformed gagal", async () => {
  const root = await mkdtemp(join(tmpdir(), "lizzy-config-"));
  const home = join(root, "home"); const cwd = join(root, "project");
  try {
    expect(await loadConfig(cwd, home)).toEqual({ version: 1, shell: {} });
    await mkdir(join(home, ".lizzy"), { recursive: true });
    await mkdir(join(cwd, ".lizzy"), { recursive: true });
    await writeFile(join(home, ".lizzy", "config.jsonc"), '{"shell":{"bash":"global"}}');
    await writeFile(join(cwd, ".lizzy", "config.jsonc"), '{"shell":{"bash":"project"}}');
    expect((await loadConfig(cwd, home)).shell.bash).toBe("project");
    await writeFile(join(cwd, ".lizzy", "config.jsonc"), "{");
    await expect(loadConfig(cwd, home)).rejects.toThrow("JSONC");
  } finally { await rm(root, { recursive: true, force: true }); }
});
```

- [ ] **Step 2: Red.** `rtk bun test test/config.test.ts` → modul belum ada.
- [ ] **Step 3: Tambahkan zod dan parser.** `rtk bun add --exact zod`. Isi `src/config.ts`:

```ts
import { z } from "zod";

const layer = z.strictObject({
  version: z.literal(1).optional(),
  shell: z.strictObject({ bash: z.string().min(1).optional() }).optional(),
});
export type ConfigLayer = z.infer<typeof layer>;
export type Config = { version: 1; shell: { bash?: string } };

export function parseConfig(text: string, label: string): ConfigLayer {
  let value: unknown;
  try { value = Bun.JSONC.parse(text.replace(/^\ufeff/, "")); }
  catch { throw new Error(`${label}: JSONC tidak valid; periksa tanda kutip, koma, dan kurung.`); }
  const parsed = layer.safeParse(value);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new Error(`${label}: field ${issue.path.join(".") || "root"} tidak valid (${issue.code}); gunakan version 1 dan shell.bash berupa string.`);
  }
  return parsed.data;
}
export function mergeConfig(global: ConfigLayer, project: ConfigLayer): Config {
  return { version: project.version ?? global.version ?? 1, shell: { ...global.shell, ...project.shell } };
}
```

Tidak ada generic deep merge: F0 hanya mengenal `version` dan `shell.bash`. Tambahkan schema provider/budget saat fasenya datang; array dan kebijakan merge-nya belum diperlukan.

- [ ] **Step 4: Implementasikan file boundary.** `src/platform/config.ts`:

```ts
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { type Config, mergeConfig, parseConfig } from "../config";

async function readLayer(path: string) {
  let text: string;
  try { text = await readFile(path, "utf8"); }
  catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return {};
    throw new Error(`${path}: config tidak dapat dibaca; periksa izin akses dan jenis file.`);
  }
  return parseConfig(text, path);
}
export async function loadConfig(cwd = process.cwd(), home = homedir()): Promise<Config> {
  const [global, project] = await Promise.all([
    readLayer(join(home, ".lizzy", "config.jsonc")),
    readLayer(join(cwd, ".lizzy", "config.jsonc")),
  ]);
  return mergeConfig(global, project);
}
```

Di `src/app.ts`, import `loadConfig` dari `./platform/config` dan panggil `await loadConfig()` sebelum pesan skeleton. Entry `src/cli.ts` tetap hanya mengimpor aplikasi secara dinamis.
- [ ] **Step 5: Tambahkan regression test fast path di `test/cli.test.ts`.** Import `mkdtemp`, `mkdir`, `rm`, `writeFile` dari `node:fs/promises`, `tmpdir` dari `node:os`, dan `join` dari `node:path`:

```ts
test("config proyek invalid tidak menghalangi help/version", async () => {
  const root = await mkdtemp(join(tmpdir(), "lizzy-cli-"));
  try {
    await mkdir(join(root, ".lizzy"));
    await writeFile(join(root, ".lizzy", "config.jsonc"), "{");
    expect(invoke(["--help"], process.env, root).status).toBe(0);
    expect(invoke(["--version"], process.env, root).status).toBe(0);
    const normal = invoke([], process.env, root);
    expect(normal.status).toBe(1);
    expect(normal.stdout).toBe("");
    expect(normal.stderr).toContain("JSONC");
  } finally { await rm(root, { recursive: true, force: true }); }
});
```

`rtk bun test test/config.test.ts test/cli.test.ts`, `rtk bun run check`, `rtk bun run build` → exit 0.
- [ ] **Step 6: Commit.** `feat(f00): config JSONC berlapis [F00-T05]`, `Refs #` issue aktual; catat satu dependency runtime baru beserta alasan ADR-005.

## Task 6: F00-T06 — Git Bash

**Files:** Create `src/platform/shell.ts`, `test/shell.test.ts`. Modify `src/app.ts`, `test/cli.test.ts`.

**Interfaces:** Consumes `Config.shell.bash`. Produces `findGitBash(configured: string | undefined, env: NodeJS.ProcessEnv, probe: (path: string) => boolean): string` dan `resolveShell(configured?: string): string`. Resolver tidak mengeksekusi perintah user; tool bash dan kill tree tetap Fase 2.

- [ ] **Step 1: Tulis test dengan lingkungan Windows sintetis.** `test/shell.test.ts`:

```ts
import { expect, test } from "bun:test";
import { findGitBash } from "../src/platform/shell";

const env = { ProgramFiles: "C:\\Program Files", PATH: "C:\\Windows\\system32;D:\\PortableGit\\bin" };
test("config menang, lalu lokasi Git umum, lalu PATH", () => {
  const common = "C:\\Program Files\\Git\\bin\\bash.exe";
  const portable = "D:\\PortableGit\\bin\\bash.exe";
  expect(findGitBash("E:\\Git\\bin\\bash.exe", env, () => true)).toBe("E:\\Git\\bin\\bash.exe");
  expect(findGitBash(undefined, env, (p) => p === common || p === portable)).toBe(common);
  expect(findGitBash(undefined, env, (p) => p === portable)).toBe(portable);
});
test("WSL launcher dan config salah tidak lolos", () => {
  expect(() => findGitBash(undefined, env, () => false)).toThrow("git-scm.com");
  expect(() => findGitBash("C:\\bad\\bash.exe", env, () => false)).toThrow("shell.bash");
  expect(() => findGitBash("relative\\bash.exe", env, () => true)).toThrow("absolut");
});
```

- [ ] **Step 2: Red.** `rtk bun test test/shell.test.ts` → modul belum ada.
- [ ] **Step 3: Implementasikan discovery.** `src/platform/shell.ts`:

```ts
import { existsSync } from "node:fs";
import { win32 } from "node:path";
import { run } from "./process";

export function findGitBash(configured: string | undefined, env: NodeJS.ProcessEnv, probe: (path: string) => boolean): string {
  if (configured) {
    if (!win32.isAbsolute(configured)) throw new Error("shell.bash harus berupa path absolut ke Git Bash.");
    if (!probe(configured)) throw new Error("shell.bash tidak menunjuk Git Bash yang dapat dijalankan; periksa path config.");
    return configured;
  }
  const roots = [env.ProgramFiles, env.ProgramW6432, env["ProgramFiles(x86)"]].filter((v): v is string => Boolean(v));
  const common = roots.flatMap((root) => [win32.join(root, "Git", "bin", "bash.exe"), win32.join(root, "Git", "usr", "bin", "bash.exe")]);
  if (env.LOCALAPPDATA) common.push(win32.join(env.LOCALAPPDATA, "Programs", "Git", "bin", "bash.exe"));
  const path = (env.PATH ?? env.Path ?? "").split(";").filter(Boolean).map((dir) => win32.join(dir.replace(/^"|"$/g, ""), "bash.exe"));
  for (const candidate of new Set([...common, ...path])) {
    if (/\\windows\\system32\\bash\.exe$/i.test(candidate)) continue;
    if (probe(candidate)) return candidate;
  }
  throw new Error("Git Bash tidak ditemukan. Instal Git for Windows dari https://git-scm.com/download/win atau isi shell.bash dengan path absolut bash.exe.");
}
function isGitBash(path: string): boolean {
  if (!existsSync(path) || !/bash\.exe$/i.test(path)) return false;
  try {
    const output = run([path, "--noprofile", "--norc", "-c", "uname -s"], { ...process.env, BASH_ENV: "", ENV: "" });
    return /^(MINGW\d*|MSYS)_NT-/m.test(output);
  } catch { return false; }
}
export function resolveShell(configured?: string): string {
  if (process.platform === "win32") return findGitBash(configured, process.env, isGitBash);
  const shell = configured ?? Bun.which("bash");
  if (!shell || !existsSync(shell)) throw new Error("bash tidak ditemukan; instal bash atau periksa shell.bash.");
  return shell;
}
```

- [ ] **Step 4: Integrasikan startup.** Isi akhir `src/app.ts` sebelum probe T08:

```ts
import { loadConfig } from "./platform/config";
import { resolveShell } from "./platform/shell";

export async function start(): Promise<number> {
  const config = await loadConfig();
  resolveShell(config.shell.bash);
  process.stderr.write("Skeleton siap. Pemanggilan model belum tersedia di Fase 0.\n");
  return 0;
}
```

- [ ] **Step 5: Integration test Windows tanpa instalasi yang terdeteksi.** Tambahkan test di `test/cli.test.ts`:

```ts
test("startup Windows tanpa Git memberi petunjuk, help tetap tersedia", async () => {
  if (process.platform !== "win32") return;
  const root = await mkdtemp(join(tmpdir(), "lizzy-no-git-"));
  try {
    const cleanEnv = { ...process.env, PATH: "", Path: "", ProgramFiles: root, ProgramW6432: root, "ProgramFiles(x86)": root, LOCALAPPDATA: root, USERPROFILE: root, LIZZY_PERF_PROBE: "0" };
    const result = invoke([], cleanEnv, root);
    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("Git Bash");
    expect(result.stderr).toContain("git-scm.com");
    expect(invoke(["--help"], cleanEnv, root).status).toBe(0);
  } finally { await rm(root, { recursive: true, force: true }); }
});
```

Subprocess memakai cwd/home fixture kosong untuk menghindari config pribadi. Test spesifik Windows ini bukan pengganti test murni yang berjalan pada kedua OS. Jangan mengubah suite lain menjadi skip.
- [ ] **Step 6: Green dan commit.** `rtk bun test test/shell.test.ts test/cli.test.ts`, `rtk bun run check` → lulus; cek startup normal di Git Bash asli. Commit `feat(f00): temukan Git Bash Windows [F00-T06]`, body `Refs #` issue aktual.

## Task 7: F00-T07 — Mock provider

**Files:** Create `test/helpers/mock-provider.ts`, `test/mock-provider.test.ts`, dan empat fixture `test/fixtures/providers/{openai,anthropic}.{json,sse}`.

**Interfaces:** Produces `startMockProvider(): { url: URL; requests: Array<{ path: string; body: unknown }>; stop(): Promise<void> }`. Endpoint `POST /v1/chat/completions` dan `POST /v1/messages`; `body.stream === true` memilih SSE. Fixture sintetis tidak menyimpan rekaman secret provider.

- [ ] **Step 1: Tulis test wire dan lifecycle.** `test/mock-provider.test.ts`:

```ts
import { expect, test } from "bun:test";
import { startMockProvider } from "./helpers/mock-provider";

test.each([
  ["/v1/chat/completions", "openai"],
  ["/v1/messages", "anthropic"],
])("mock %s mengirim JSON dan SSE", async (path, protocol) => {
  const mock = startMockProvider();
  try {
    expect(mock.url.hostname).toBe("127.0.0.1");
    for (const stream of [false, true]) {
      const response = await fetch(new URL(path, mock.url), { method: "POST", headers: { "content-type": "application/json", "x-api-key": "FAKE_KEY_FOR_TEST_ONLY" }, body: JSON.stringify({ model: "fake-model", messages: [], max_tokens: 16, stream }) });
      expect(response.status).toBe(200);
      const expected = await Bun.file(new URL(`./fixtures/providers/${protocol}.${stream ? "sse" : "json"}`, import.meta.url)).text();
      expect(await response.text()).toBe(expected);
      expect(response.headers.get("content-type")).toContain(stream ? "text/event-stream" : "application/json");
    }
    expect(mock.requests).toHaveLength(2);
    expect((await fetch(new URL("/unknown", mock.url))).status).toBe(404);
  } finally { await mock.stop(); }
});
```

- [ ] **Step 2: Red.** `rtk bun test test/mock-provider.test.ts` → helper belum ada.
- [ ] **Step 3: Buat fixture JSON.** `openai.json`:

```json
{"id":"chatcmpl-fake","object":"chat.completion","created":0,"model":"fake-model","choices":[{"index":0,"message":{"role":"assistant","content":"Hello"},"finish_reason":"stop"}],"usage":{"prompt_tokens":4,"completion_tokens":1,"total_tokens":5}}
```

`anthropic.json`:

```json
{"id":"msg_fake","type":"message","role":"assistant","model":"fake-model","content":[{"type":"text","text":"Hello"}],"stop_reason":"end_turn","stop_sequence":null,"usage":{"input_tokens":4,"output_tokens":1}}
```

`openai.sse` (pertahankan baris kosong antar event dan setelah sentinel):

```text
data: {"id":"chatcmpl-fake","object":"chat.completion.chunk","created":0,"model":"fake-model","choices":[{"index":0,"delta":{"role":"assistant","content":"Hel"},"finish_reason":null}]}

data: {"id":"chatcmpl-fake","object":"chat.completion.chunk","created":0,"model":"fake-model","choices":[{"index":0,"delta":{"content":"lo"},"finish_reason":null}]}

data: {"id":"chatcmpl-fake","object":"chat.completion.chunk","created":0,"model":"fake-model","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}

data: {"id":"chatcmpl-fake","object":"chat.completion.chunk","created":0,"model":"fake-model","choices":[],"usage":{"prompt_tokens":4,"completion_tokens":1,"total_tokens":5}}

data: [DONE]

```

`anthropic.sse`:

```text
event: message_start
data: {"type":"message_start","message":{"id":"msg_fake","type":"message","role":"assistant","model":"fake-model","content":[],"stop_reason":null,"stop_sequence":null,"usage":{"input_tokens":4,"output_tokens":0}}}

event: content_block_start
data: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}

event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hello"}}

event: content_block_stop
data: {"type":"content_block_stop","index":0}

event: message_delta
data: {"type":"message_delta","delta":{"stop_reason":"end_turn","stop_sequence":null},"usage":{"output_tokens":1}}

event: message_stop
data: {"type":"message_stop"}

```

- [ ] **Step 4: Buat server loopback.** `test/helpers/mock-provider.ts`:

```ts
export function startMockProvider() {
  const requests: Array<{ path: string; body: unknown }> = [];
  const server = Bun.serve({
    hostname: "127.0.0.1", port: 0,
    async fetch(request) {
      const path = new URL(request.url).pathname;
      const protocol = path === "/v1/chat/completions" ? "openai" : path === "/v1/messages" ? "anthropic" : undefined;
      if (request.method !== "POST" || !protocol) return new Response("Not found", { status: 404 });
      let body: unknown;
      try { body = await request.json(); }
      catch { return new Response("Invalid JSON", { status: 400 }); }
      if (!body || typeof body !== "object" || Array.isArray(body)) return new Response("Expected object", { status: 400 });
      requests.push({ path, body });
      const streaming = "stream" in body && body.stream === true;
      const bytes = new Uint8Array(await Bun.file(new URL(`../fixtures/providers/${protocol}.${streaming ? "sse" : "json"}`, import.meta.url)).arrayBuffer());
      const output = streaming ? new ReadableStream<Uint8Array>({ start(controller) {
        for (let offset = 0; offset < bytes.length; offset += 11) controller.enqueue(bytes.slice(offset, offset + 11));
        controller.close();
      } }) : bytes;
      return new Response(output, { headers: { "content-type": streaming ? "text/event-stream" : "application/json" } });
    },
  });
  return { url: server.url, requests, stop: async () => { await server.stop(true); } };
}
```

Chunk server berukuran kecil membantu latihan parser berikutnya, tetapi TCP dapat menggabungkannya. Fase 1 tetap harus menguji parser SSE dengan input chunk eksplisit, tool-call delta, abort, dan error. Itu belum implementasi adapter.
- [ ] **Step 5: Green dan commit.** `rtk bun test test/mock-provider.test.ts`, `rtk bun run check` → lulus tanpa internet. Commit `test(f00): mock dua protokol provider [F00-T07]`, body `Refs #` issue aktual.

## Task 8: F00-T08 — Pemeriksa regresi performa

**Files:** Create `scripts/perf.ts`, `test/perf.test.ts`. Modify `src/platform/process.ts`, `src/app.ts`, `package.json`, `.github/workflows/baseline.yml`.

**Interfaces:** Consumes `Measurement` T02 dan startup config/shell T06. Produces `checkPerformance(baseline: unknown, current: unknown): string[]`, schema pengukuran runtime, `bun run perf`. Error validasi/mismatch melempar; daftar regresi tidak kosong berarti exit 1. Workload `agent-f00-v1` berbeda dari `hello-v1`.

- [ ] **Step 1: Tulis test ambang dan input.** `test/perf.test.ts`:

```ts
import { expect, test } from "bun:test";
import { checkPerformance } from "../scripts/perf";

const measurement = {
  schemaVersion: 1, key: "win32-x64-test", bun: "1.4.2", workload: "agent-f00-v1",
  metrics: { versionMs: 100, idleRssBytes: 100, binaryBytes: 100 },
  samples: { versionMs: [100], idleRssBytes: [100] },
};
const baseline = { schemaVersion: 1, entries: [{ ...measurement, binaryLimitBytes: 120 }] };
test.each(["versionMs", "idleRssBytes", "binaryBytes"] as const)("gerbang %s tepat >20 persen", (metric) => {
  expect(checkPerformance(baseline, { ...measurement, metrics: { ...measurement.metrics, [metric]: 120 } })).toEqual([]);
  expect(checkPerformance(baseline, { ...measurement, metrics: { ...measurement.metrics, [metric]: 121 } }).length).toBeGreaterThan(0);
});
test("baseline tidak matching dan input invalid tidak menjadi hijau", () => {
  expect(() => checkPerformance({ schemaVersion: 1, entries: [] }, measurement)).toThrow();
  expect(() => checkPerformance(baseline, { ...measurement, bun: "0.0.0" })).toThrow();
  expect(() => checkPerformance(baseline, { ...measurement, workload: "hello-v1" })).toThrow();
  expect(() => checkPerformance(baseline, { ...measurement, metrics: { ...measurement.metrics, versionMs: Number.NaN } })).toThrow();
  expect(() => checkPerformance({ schemaVersion: 1, entries: [{ ...measurement, metrics: { ...measurement.metrics, binaryBytes: 0 }, binaryLimitBytes: 120 }] }, measurement)).toThrow();
});
```

Angka 100/120/121 hanya fixture tes matematika, tidak pernah disalin menjadi baseline real.
- [ ] **Step 2: Red.** `rtk bun test test/perf.test.ts` → modul belum tersedia.
- [ ] **Step 3: Buat comparator dan entry pengukuran.** `scripts/perf.ts`:

```ts
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { z } from "zod";
import { measure } from "./measure-perf";

const positive = z.number().finite().positive();
export const measurementSchema = z.strictObject({
  schemaVersion: z.literal(1), key: z.string().min(1), bun: z.string().min(1), workload: z.string().min(1),
  metrics: z.strictObject({ versionMs: positive, idleRssBytes: positive, binaryBytes: positive }),
  samples: z.strictObject({ versionMs: z.array(positive).min(1), idleRssBytes: z.array(positive).min(1) }),
});
export const baselineSchema = z.strictObject({
  schemaVersion: z.literal(1),
  entries: z.array(measurementSchema.extend({ binaryLimitBytes: positive })).min(1),
});
export function checkPerformance(baseline: unknown, current: unknown): string[] {
  const data = baselineSchema.parse(baseline);
  const sample = measurementSchema.parse(current);
  const matches = data.entries.filter((entry) => entry.key === sample.key && entry.bun === sample.bun && entry.workload === sample.workload);
  if (matches.length !== 1) throw new Error(`Butuh tepat satu baseline ${sample.key}, Bun ${sample.bun}, ${sample.workload}; kumpulkan dan review baseline matching.`);
  const reference = matches[0];
  const failures: string[] = [];
  for (const metric of ["versionMs", "idleRssBytes", "binaryBytes"] as const) {
    if (sample.metrics[metric] > reference.metrics[metric] * 1.2) failures.push(`${metric}: ${sample.metrics[metric]} > 120% baseline ${reference.metrics[metric]}`);
  }
  if (sample.metrics.binaryBytes > reference.binaryLimitBytes) failures.push(`binaryBytes melampaui target absolut ${reference.binaryLimitBytes}`);
  return failures;
}
if (import.meta.main) {
  try {
    const artifact = resolve(join("dist", process.platform === "win32" ? "agent.exe" : "agent"));
    const input = process.argv[2];
    const current: unknown = input ? JSON.parse(readFileSync(input, "utf8")) : measure([artifact], artifact, "agent-f00-v1", process.env.LIZZY_PERF_RUNNER ?? "local");
    const baseline: unknown = JSON.parse(readFileSync("docs/perf/baseline.json", "utf8"));
    const failures = checkPerformance(baseline, current);
    process.stdout.write(`${JSON.stringify({ current, failures }, null, 2)}\n`);
    process.exitCode = failures.length ? 1 : 0;
  } catch (error) {
    process.stderr.write(`Perf gagal: ${error instanceof Error ? error.message : "data tidak valid"}\n`);
    process.exitCode = 1;
  }
}
```

- [ ] **Step 4: Ukur aplikasi yang sudah inisialisasi.** Tambahkan helper ini ke `src/platform/process.ts`, lalu panggil di `src/app.ts` setelah `loadConfig` dan `resolveShell`, sebelum pesan skeleton:

```ts
export async function reportIdleProbe(): Promise<boolean> {
  if (process.env.LIZZY_PERF_PROBE !== "1") return false;
  await Bun.sleep(200);
  process.stdout.write(`${JSON.stringify({ rss: process.memoryUsage().rss })}\n`);
  return true;
}
```

Perubahan startup:

```ts
import { reportIdleProbe } from "./platform/process";
// Setelah resolveShell(config.shell.bash):
if (await reportIdleProbe()) return 0;
```

Probe hanya mengamati startup skeleton; belum TUI kosong Fase 9. Jangan menamai hasilnya idle TUI. Tambahkan `"perf": "bun scripts/perf.ts"` ke scripts package.

- [ ] **Step 5: Perluas workflow pengumpulan.** Tambahkan `bun run build` setelah compile hello, kemudian step `shell: bun {0}` sebelum upload:

```ts
import { join, resolve } from "node:path";
import { measure } from "./scripts/measure-perf.ts";
const binary = resolve(join("dist", process.platform === "win32" ? "agent.exe" : "agent"));
await Bun.write("dist/agent-measurement.json", JSON.stringify(measure([binary], binary, "agent-f00-v1", process.env.LIZZY_PERF_RUNNER), null, 2));
```

Workflow dijalankan pada account runner bersih, tanpa config `.lizzy` pribadi. Rekam identitas image dan commit dalam artifact T02. Key membedakan OS/arch dan kelas runner; image revision disimpan sebagai metadata untuk audit, perubahan kelas hardware atau pin Bun memerlukan baseline baru.
- [ ] **Step 6: Green dan negative CLI.** `rtk bun test test/perf.test.ts test/measure-perf.test.ts`, `rtk bun run check`, `rtk bun run build` → exit 0. `rtk bun run perf` saat baseline belum ada wajib exit 1 dengan diagnostic file missing; jangan menambahkan skip agar hijau.
- [ ] **Step 7: Commit.** `perf(f00): gate tiga metrik terhadap baseline [F00-T08]`, body `Refs #` issue aktual. Gerbang CI baru diwajibkan setelah data T09 tersedia dalam PR yang sama dengan pengaktifannya.

## Task 9: F00-T09 — Baseline dan CI perf

**Files:** Create `docs/perf/baseline.json`, `scripts/assemble-baseline.ts`. Modify `test/perf.test.ts`, `docs/adr/006-gerbang-performa.md:22`, `docs/perf/measurement.md`, `.github/workflows/ci.yml`, `scripts/setup-github.sh:77`, `docs/WORKFLOW.md:67`.

**Interfaces:** Consumes artifacts `hello-measurement.json`/`agent-measurement.json` pada tiga OS dan comparator T08. Produces accepted baseline enam entry minimum, binaryLimitBytes berdasarkan pengukuran, dan jobs `perf (ubuntu-latest)`/`perf (windows-latest)`.

- [ ] **Step 1: Kumpulkan data aktual.** Jalankan workflow `baseline` pada commit aplikasi T08; unduh artifacts Linux/Windows/macOS. Verifikasi `environment.json` cocok dengan commit dan Bun pin. Cross-compile saja tidak cukup. Untuk `bun run perf` lokal, kumpulkan juga pasangan hello/agent pada mesin lokal dan simpan entry dengan suffix `local`; jangan memalsukan `LIZZY_PERF_RUNNER` agar mesin lokal dianggap runner CI.
- [ ] **Step 2a: Tulis test input assembler.** Tambahkan import `spawnSync` dari `node:child_process` di `test/perf.test.ts` dan test berikut:

```ts
test("assembler menolak baseline tanpa enam pengukuran", () => {
  const result = spawnSync(process.execPath, ["scripts/assemble-baseline.ts"], { encoding: "utf8", windowsHide: true });
  expect(result.status).not.toBe(0);
  expect(result.stderr).toContain("enam file measurement native");
});
```

- [ ] **Step 2b: Buktikan red.** `rtk bun test test/perf.test.ts` → pesan modul belum ada berbeda dari error input yang diharapkan.
- [ ] **Step 2c: Susun baseline tanpa angka manual.** Isi `scripts/assemble-baseline.ts`:

```ts
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { baselineSchema, measurementSchema } from "./perf";

const inputs = process.argv.slice(2);
if (inputs.length < 6) throw new Error("Berikan enam file measurement native: hello dan agent untuk tiga OS.");
if (existsSync("docs/perf/baseline.json")) throw new Error("Baseline sudah ada; perubahan berikutnya memerlukan PR spec-change dengan data pembanding.");
const entries = inputs.map((file) => {
  const measured = measurementSchema.parse(JSON.parse(readFileSync(file, "utf8")));
  return { ...measured, binaryLimitBytes: Math.ceil(measured.metrics.binaryBytes * 1.2) };
});
for (const runner of ["ubuntu-latest", "windows-latest", "macos-latest"]) {
  for (const workload of ["hello-v1", "agent-f00-v1"]) {
    if (entries.filter((entry) => entry.key.endsWith(`-${runner}`) && entry.workload === workload && entry.bun === "1.4.2").length !== 1) throw new Error(`Butuh satu measurement ${runner}/${workload}/Bun 1.4.2`);
  }
}
const unique = new Set(entries.map((entry) => `${entry.key}/${entry.bun}/${entry.workload}`));
if (unique.size !== entries.length) throw new Error("Measurement duplikat.");
const baseline = baselineSchema.parse({ schemaVersion: 1, entries });
writeFileSync("docs/perf/baseline.json", `${JSON.stringify(baseline, null, 2)}\n`, { flag: "wx" });
```

Panggil skrip dengan path nyata keenam artifact yang diunduh, ditambah dua measurement lokal jika diperlukan. Target awal `ceil(byte terukur × 1.2)` adalah proposal anggaran yang harus direview bersama ADR-006, bukan batas 60 MB. Reference hello dipertahankan untuk memisahkan lantai runtime dari overhead aplikasi; gate rutin memakai `agent-f00-v1`.
- [ ] **Step 3: Tulis keputusan berbukti.** Di bagian hasil ADR-006, tautkan artifact/run, salin tabel metrics dari baseline, jelaskan median, warm cache, child RSS 200 ms, runner class, serta batas absolut per platform. Catat variabilitas raw samples; bila runner terlalu bervariasi untuk ambang20%, jangan mengubah ambang diam-diam. Review baseline dan hasil ADR menggunakan `spec-change` sebelum merge.
- [ ] **Step 4: Aktifkan job perf.** Tambahkan job berikut ke CI existing; job `check` tetap Linux/Windows, frozen install dan check. Tidak ada kondisi `hashFiles` yang membiarkan perf tanpa baseline lulus:

```yaml
  perf:
    name: perf (${{ matrix.os }})
    strategy:
      fail-fast: false
      matrix:
        os: [ubuntu-latest, windows-latest]
    runs-on: ${{ matrix.os }}
    env:
      LIZZY_PERF_RUNNER: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version-file: .bun-version
      - run: bun install --frozen-lockfile
      - run: bun run build
      - name: Measure and enforce gate
        shell: bun {0}
        run: |
          import { mkdirSync, writeFileSync } from "node:fs";
          import { join, resolve } from "node:path";
          import { measure } from "./scripts/measure-perf.ts";
          import { checkPerformance } from "./scripts/perf.ts";
          const binary = resolve(join("dist", process.platform === "win32" ? "agent.exe" : "agent"));
          const current = measure([binary], binary, "agent-f00-v1", process.env.LIZZY_PERF_RUNNER);
          const failures = checkPerformance(await Bun.file("docs/perf/baseline.json").json(), current);
          mkdirSync("dist", { recursive: true });
          writeFileSync("dist/perf-result.json", JSON.stringify({ current, failures }, null, 2));
          for (const failure of failures) console.error(failure);
          process.exitCode = failures.length ? 1 : 0;
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: perf-${{ matrix.os }}
          path: dist/perf-result.json
          if-no-files-found: error
```

- [ ] **Step 5: Buktikan job benar-benar merah.** Di branch PR task ini, sementara sisipkan kode berikut setelah `current` dibuat dan sebelum comparator dipanggil:

```ts
const baselineForInjection = await Bun.file("docs/perf/baseline.json").json();
const baselineEntry = baselineForInjection.entries.find((entry: { key: string; bun: string; workload: string }) => entry.key === current.key && entry.bun === current.bun && entry.workload === current.workload);
if (!baselineEntry) throw new Error("Baseline untuk injeksi tidak ditemukan.");
current.metrics.binaryBytes = baselineEntry.metrics.binaryBytes * 1.21;
```

Jalankan CI dan simpan URL job perf gagal beserta diagnostic. Hapus injeksi tersebut, jalankan lagi dan simpan run hijau. Jangan mengubah baseline untuk menjadikan run kedua hijau. Test T08 menguji tiap metrik; injeksi pipeline membuktikan exit nonzero tidak tertelan workflow.
- [ ] **Step 6: Sinkronkan nama protection.** Ganti tepat `CHECKS` di `scripts/setup-github.sh`:

```bash
CHECKS='["check (ubuntu-latest)", "check (windows-latest)", "perf (ubuntu-latest)", "perf (windows-latest)"]'
```

Perbarui daftar nama di `docs/WORKFLOW.md`. Syntax check tanpa side effect: dari Windows `rtk proxy "C:\Program Files\Git\bin\bash.exe" --noprofile --norc -n scripts/setup-github.sh`. User menjalankan setup untuk mengubah proteksi; exit sukses skrip saja bukan bukti proteksi terpasang karena skrip menangkap kegagalan API. Bukti adalah daftar required checks aktual di GitHub.
- [ ] **Step 7: Verifikasi dan commit.** `rtk bun run check`, `rtk bun run build`, `rtk bun run perf` pada baseline matching, CI final hijau. Commit `perf(f00): baseline terukur dan CI wajib [F00-T09]`, body `Refs #` issue aktual. Jangan membuat baseline dari angka contoh plan ini.

## Task 10: F00-T10 — Dokumentasi dan gerbang

**Files:** Create `README.md`, `docs/perf/fase-00-gate.md`. Modify `README-KIT.md`, bagian laporan gerbang `docs/phases/fase-00.md`.

**Interfaces:** Consumes sepuluh acceptance fase, hasil test/build/spike/CI. Produces dokumentasi yang sesuai produk F0 dan laporan evidence; tidak ada API produksi baru.

- [ ] **Step 1: Tulis README dengan klaim terbatas pada hasil F0.** Isi pembuka dan penggunaan:

```markdown
# Lizzy Agent

Skeleton coding agent CLI Bun-only. Fase 0 menyediakan CLI, config JSONC,
deteksi Git Bash, mock provider untuk pengembangan, dan gerbang performa.
Pemanggilan model dan loop agent belum tersedia.

Kebutuhan pengembangan: Bun sesuai `.bun-version`; Git; pada Windows,
Git for Windows dengan Git Bash. Runtime Node tidak didukung.

## Pengembangan

    bun install --frozen-lockfile
    bun run check
    bun run build
    bun run perf

Binary Linux/macOS: `./dist/agent --help`. Windows: `.\dist\agent.exe --help`.
Gunakan `--version` untuk versi build. Kedua flag tetap berjalan tanpa config.

Config global: `~/.lizzy/config.jsonc`. Config proyek: `.lizzy/config.jsonc`
di direktori kerja. Field proyek menimpa field global yang sama.
Config kosong valid. Contoh Git Bash Windows:

    {
      "version": 1,
      "shell": { "bash": "C:\\Program Files\\Git\\bin\\bash.exe" }
    }

Lihat `docs/phases/fase-00.md` untuk scope dan acceptance, `docs/WORKFLOW.md`
untuk cara kontribusi, serta `docs/perf/measurement.md` untuk lingkungan
baseline yang dapat dibandingkan. Pengukuran lokal memerlukan baseline lokal.
```

- [ ] **Step 2: Update README-KIT dengan hasil setup.** Pertahankan dokumentasi setup awal, tambahkan tautan README dan fase00; tandai empat status check final. Jangan menghapus aturan starter atau menulis bahwa setup GitHub sudah dilakukan bila belum dibuktikan.
- [ ] **Step 3: Jalankan seluruh gerbang spec.** Perintah inti:

```powershell
rtk bun install --frozen-lockfile
rtk bun run check
rtk bun run build
rtk bun run perf
rtk bun scripts/sync-issues.ts docs/phases/fase-00.md --dry-run
rtk bun test spikes/renderer/compare.test.ts
```

Ditambah binary smoke Windows/Linux, results native macOS, dan kedua run CI injeksi/final T09. Eval model asli tidak dijalankan karena harness eval baru Fase 2 dan F0 belum memanggil model.
- [ ] **Step 4: Catat bukti aktual.** `docs/perf/fase-00-gate.md` harus memuat tanggal/commit, Bun, OS/arch/terminal, setiap perintah dengan exit/output ringkas, metrics aktual/reference/selisih%, URL artifacts tiga OS, hasil dua backend renderer, URL CI merah injeksi dan hijau final, serta nama required checks aktual. Sumber angka adalah file baseline/result, bukan salinan narasi. Item tanpa bukti ditandai **belum terbukti** dan gerbang fase tetap belum lulus. Tautkan laporan dari spec fase.
- [ ] **Step 5: Review coverage dan commit.** Cocokkan sembilan keluaran Fase 0 di `PLAN.md:428` dengan sepuluh task ini. Commit `docs(f00): pemakaian dan bukti gerbang [F00-T10]`, body `Refs #` issue aktual. User menutup milestone setelah review. Fase 0 bukan batas rilis; tidak membuat tag atau memulai Fase 1 otomatis.

## Coverage terhadap spec

| Requirement Fase 0 | Task |
|---|---|
| Bun-only, strict, lint, format, test | T01 |
| Help/version minimal, parser, binary | T04, T05/T06 regression tests |
| Global/project JSONC, version, zod, empty config | T05 |
| Mock provider kedua bentuk protokol | T07 |
| Hello-world native tiga OS, data baseline | T02, T08, T09 |
| Perbandingan renderer, ukuran dan ketikan, ADR | T03 |
| Git Bash config/common/PATH dan actionable error | T06 |
| Scripts build/check/perf, CI dan demonstrasi >20% | T01, T04, T08, T09 |
| Workflow dan gerbang terdokumentasi | T09, T10; reuse starter existing |

## Referensi API yang diperiksa untuk rencana

- Context7 `/oven-sh/bun`: [JSONC tests resmi](https://github.com/oven-sh/bun/blob/main/test/js/bun/jsonc/jsonc.test.ts), [HTTP server](https://github.com/oven-sh/bun/blob/main/docs/runtime/http/server.mdx): `Bun.JSONC.parse`, loopback/port 0, `server.stop(true)`.
- Context7 `/colinhacks/zod`: [API/schema](https://github.com/colinhacks/zod/blob/main/packages/docs/content/api.mdx), [error formatting](https://github.com/colinhacks/zod/blob/main/packages/docs/content/error-formatting.mdx): strict schema, safeParse, issue.path/code. Jangan log input Zod atau pesan parser mentah.
- Context7 `/earendil-works/pi`: [TUI README](https://github.com/earendil-works/pi/blob/main/packages/tui/README.md), [TUI guide](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/tui.md), [license](https://github.com/earendil-works/pi/blob/main/LICENSE). Paket dan API harus cocok dengan versi yang dipin pada spike; library belum diinstal oleh penyusunan plan.

## Status verifikasi rencana

Dokumen ditinjau terhadap Fase 0, enam ADR, workflow, format parser issue dan temuan roadmap. Kode di dalam Markdown belum dieksekusi: Bun tidak tersedia dalam environment perencanaan. Bukti runtime, Windows/Linux/macOS, benchmark, dan keputusan renderer tetap merupakan keluaran task yang harus benar-benar dijalankan.

Verifikasi dokumen yang sudah dijalankan pada 8 November 2026:

- `rtk proxy node scripts/sync-issues.ts docs/phases/fase-00.md --dry-run` → exit 0, sepuluh task beserta label/dependensi terbaca, tidak memanggil GitHub. Node 24.18 dipakai hanya untuk skrip starter yang memang memakai `node:*`; ini bukan pengujian produk atau penambahan target runtime Node.
- Pemeriksaan lokal dengan Python → sepuluh ID berurutan, dependency graph tanpa siklus, 15 tautan lokal/anchor valid, enam contoh JSON valid, fence kode berpasangan.
- SHA-256 `docs/PLAN.md` dan `docs/PLAN.html` tetap sama dengan sebelum penulisan plan. Tidak ada perubahan pada roadmap sumber.
