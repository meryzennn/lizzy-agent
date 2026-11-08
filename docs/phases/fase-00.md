# Fase 00 — Skeleton repo dan harness

> **Goal:** Repo hidup, CLI kosong jalan, harness test dan mock provider siap.
> **Architecture:** Bun-only dengan entry CLI ringan, JSONC + zod yang dimuat malas, serta akses OS terpusat di `src/platform/`. Harness HTTP lokal dan pengukuran performa dipakai ulang oleh fase berikutnya. Dua spike menghasilkan bukti sebelum pemilihan renderer dan batas binary.
> **Tech stack:** TypeScript strict, Bun, zod; Biome dan TypeScript sebagai tooling development.
> **Plan:** `docs/PLAN.html` bagian R/C/Fase 0; `docs/PLAN.md:420`; ADR-001 sampai ADR-006.
> **Langkah lengkap:** [Fase 00 Foundation Implementation Plan](../superpowers/plans/2026-11-08-fase-00-foundation.md). File ini adalah spec dan manifest task untuk `sync-issues`; kode serta siklus test/implementasi/commit berada di rencana tersebut, sehingga tidak disalin dua kali.

## Hasil pembacaan repository, 8 November 2026

Seluruh 28 file awal diperiksa: 13 file di `docs/` termasuk HTML, Markdown, enam ADR, indeks ADR, template fase dan dua `.gitkeep`; serta 15 file aturan, command, workflow, template GitHub, dan skrip di luar `docs/`. HTML dipelajari termasuk CSS dan JavaScript-nya. Referensi eksternal dalam riset dibaca sebagai klaim dokumen; sumber riset tersebut tidak semuanya diverifikasi ulang.

Kondisi awal saat rencana pertama ditulis (snapshot historis, bukan status eksekusi saat ini):

- Belum ada `.git`, remote GitHub, `package.json`, lockfile, `src/`, atau `test/`.
- Bun tidak ditemukan di PATH maupun lokasi instalasi umum yang diperiksa. Git dan GitHub CLI tersedia.
- Git Bash tersedia di `C:\Program Files\Git\bin\bash.exe`, tetapi `bash` di PATH menunjuk launcher WSL `C:\Windows\system32\bash.exe`.
- `scripts/sync-issues.ts` sudah mengekspor `githubSlug`, `parsePhase`, `issueTitle`, dan `issueBody`; gunakan fungsi ini, jangan membuat parser issue baru.
- CI sekarang melewati check bila paket belum ada. Begitu `package.json` dibuat, lockfile dan `check` yang sungguh berjalan harus tersedia dalam PR yang sama.
- Baseline performa dan hasil spike renderer belum ada. Folder `docs/perf/` dan `docs/evals/` masih kosong.

### Sumber kebenaran dan temuan yang memengaruhi rencana

Urutan: ADR → prinsip C → spec fase → issue. `PLAN.md` menyatakan HTML menang bila kedua representasi berbeda; bagian R mengalahkan catatan riset A2–A4.

| Temuan | Keputusan untuk Fase 0 |
|---|---|
| Peta rilis B masih menyebut Ink; ADR-003 dan Fase 9 melarangnya | Ikuti renderer diferensial. Jangan memasang Ink/React untuk TUI. |
| A4 masih mencantumkan binary <60 MB | Angka historis, bukan batas acceptance. Ukur tiga OS dan tetapkan target melalui ADR-006. |
| Daftar Fase 15 tidak konsisten dengan ringkasan ±38 token/5 tema | Catat sebagai bahan klarifikasi ketika Fase 15 direncanakan; jangan memilih jumlah tema sekarang. |
| Prinsip stdout JSONL vs headless teks dasar Fase 2 | Fase 0 hanya `--help`/`--version`; format headless operasional harus diperjelas dalam spec Fase 2. |
| Deteksi Git Bash dapat memperberat `--version` | Flag informasi selesai sebelum config/shell dimuat; startup normal pada Windows tanpa Git Bash gagal dengan petunjuk instalasi. |
| Tidak ada nama config/path final atau versi Bun terkunci | Proposal Fase 0: executable `agent`, package privat `lizzy-agent`, config `~/.lizzy/config.jsonc` dan `<cwd>/.lizzy/config.jsonc`, Bun `1.4.2` dipin. Ini pilihan implementasi, bukan fakta dari roadmap. |

Rencana ini tidak mengubah ADR atau teks roadmap lama. Pembaruan ADR hasil spike dibuat sebagai keluaran task dan direview sebelum menjadi keputusan final.

### Peta sistem dan urutan setelah Fase 0

| Fase | Hasil utama | Fondasi yang harus dijaga |
|---|---|---|
| 0 | Skeleton, config, mock, shell discovery, spike dan perf gate | CLI murah; platform boundary; pengukuran nyata |
| 1 | Adapter HTTP OpenAI/Anthropic, metadata, preset 9Router | Mock F0; model diminta dan aktual dipisahkan; override konteks menang |
| 2 | Loop, tools, cancel, checkpoint/rewind, REPL, eval | Shell F0; tool edit menjaga CRLF/BOM; cancel membunuh pohon proses |
| 3 | Permissions dan mode | Deny > ask > allow; parser bash WASM; konten eksternal tak tepercaya |
| 4 | Context management | Prompt berversi; pruning/compaction; eval F2 |
| 5 | Sesi JSONL portabel | Record mentah usage/pesan/event; redaksi sebelum persistensi |
| 6 | Hard budget dan combo | Token/giliran untuk semua model; retry pendek; transkrip valid saat pindah |
| 7 | Verification gate | Runner memverifikasi; hash melindungi test/config walau diubah lewat bash |
| 8 | MCP client | Registry tools/permission yang sama; import malas |
| 9 | Headless lengkap dan TUI | Pilihan renderer F0; scrollback committed; gerbang PTY Windows/Linux |
| 10 | Subagent | Brief terstruktur, context segar, batas kedalaman/konkurensi |
| 11 | Orchestration | SQLite Run/Task/Dispatch, worktree writer, integrasi dipicu user |
| 12 | Stats lokal dan resource | Rollup JSONL F5; Host/Origin/token; RSS induk dilabeli secara jujur |
| 13 | Frustrasi dan saran model | Atribusi model aktual; leksikon EN/ID; saran perlu persetujuan |
| 14 | Discord presence | Spike named pipe compiled; IPC lokal; privasi; coalescer 15 detik |
| 15 | Tema/status line/performa | Dua lapis status line; budget; target absolut dan sesi panjang |

Batas rilis: F3 `v0.1.0`, F7 `v0.2.0`, F10 `v0.3.0`, F11 `v0.4.0`, F13 `v0.5.0`, F14 `v0.6.0`, F15 `v0.7.0`. Tidak ada tag rilis setelah Fase 0. File implementasi fase selanjutnya ditulis setelah fase sebelumnya lulus, mengikuti `docs/WORKFLOW.md:22`.

## Kriteria selesai fase (gerbang)

Perintah di bawah adalah acceptance yang akan dijalankan saat implementasi; belum merupakan hasil verifikasi.

- [ ] `rtk bun install --frozen-lockfile` dan `rtk bun run check` lulus di Linux dan Windows.
- [ ] `rtk bun run build`; binary native menjalankan `--help` dan `--version`, stdout hanya hasil, stderr kosong pada sukses.
- [ ] `rtk bun test test/config.test.ts test/shell.test.ts test/cli.test.ts` lulus, termasuk config kosong/invalid, prioritas proyek, dan Windows tanpa Git Bash.
- [ ] `rtk bun test test/mock-provider.test.ts` membuktikan kedua protokol, JSON dan SSE, semua request hanya ke loopback.
- [ ] Spike boot memiliki data native Linux/Windows/macOS dengan versi Bun, arsitektur, runner, metode, dan raw samples.
- [ ] Spike renderer memiliki dua prototipe; kedua entry source final dan kedua executable compiled dijalankan native Windows/Linux dengan workload input/stream/resize/Escape/Ctrl+C yang sama. Ukuran, latensi, exit dan restore dicatat terpisah per mode; ADR-003 menyimpan keputusan berdasarkan hasil.
- [ ] `docs/perf/baseline.json` berisi angka terukur, ADR-006 menjelaskan target binary dan lingkungan pembanding, bukan angka tebakan.
- [ ] `rtk bun run perf` hijau terhadap baseline key/OS/arch/Bun/workload yang sesuai; key lokal menghash host + hardware tanpa hostname mentah, key CI memuat label runner + hash kelas hardware. Mismatch ditolak; input regresi >20% membuat pemeriksa dan job CI merah.
- [ ] CI `check (ubuntu-latest)`, `check (windows-latest)`, `perf (ubuntu-latest)`, dan `perf (windows-latest)` berjalan. User memverifikasi keempat nama pada proteksi branch setelah meninjau setup.
- [ ] `rtk bun scripts/sync-issues.ts docs/phases/fase-00.md --dry-run` membaca sepuluh task tanpa memanggil GitHub.

<!-- Task titles and acceptance text are copied to GitHub and must be English. Keep legacy anchors for published issue links. -->
## Task F00-T01 — Bootstrap the package and validation harness

<a id="task-f00-t01--bootstrap-paket-dan-harness-pemeriksaan"></a>

- **Type:** chore
- **Bergantung pada:** —
- **Files:**
  - Create: `package.json`, `bun.lock`, `.bun-version`, `tsconfig.json`, `biome.json`, `.gitignore`, `test/sync-issues.test.ts`
  - Modify: `.github/workflows/ci.yml`, `scripts/sync-issues.ts` (formatting bila diperlukan)

### Langkah

- [ ] Ikuti [Task 1](../superpowers/plans/2026-11-08-fase-00-foundation.md#task-1-f00-t01--bootstrap-paket-dan-harness) untuk test, isi konfigurasi, pin runtime, dan commit.

### Verifikasi

`rtk bun run check` → typecheck, lint, dan test parser yang sudah ada lulus; frozen install berhasil.

### Selesai bila

- [ ] The package, lockfile, Bun pin, lint/format tooling, strict TypeScript, and tests are introduced together.
- [ ] Linux and Windows checks use the same Bun version and execute the tests without skipping them.

## Task F00-T02 — Measure native startup baselines on three operating systems

<a id="task-f00-t02--spike-baseline-boot-native-tiga-os"></a>

- **Type:** spike
- **Labels:** os:windows
- **Bergantung pada:** F00-T01
- **Files:**
  - Create: `spikes/boot.ts`, `scripts/measure-perf.ts`, `src/platform/process.ts`, `test/measure-perf.test.ts`, `.github/workflows/baseline.yml`, `docs/perf/measurement.md`
  - Modify: `package.json`

### Langkah

- [ ] Ikuti [Task 2](../superpowers/plans/2026-11-08-fase-00-foundation.md#task-2-f00-t02--spike-baseline-boot-native) untuk protokol ukur, kode probe, dan pengumpulan artifact tiga OS.

### Verifikasi

`rtk bun test test/measure-perf.test.ts` → lulus; workflow `baseline` pada `pull_request` menghasilkan tiga artifact dengan raw samples sebelum merge PR pertama. `workflow_dispatch` dipertahankan untuk run manual setelah workflow ada di default branch.

### Selesai bila

- [ ] The hello-world program is compiled and executed natively on Linux, Windows, and macOS.
- [ ] Startup time and child-process RSS are measured repeatedly; binary size is recorded in bytes.
- [ ] Measurements identify the runner, OS, architecture, Bun version, checkout SHA, and key containing the local identity or CI hardware-class hash; raw local hostnames are not published. Measurements distinguish hello-world from the application.
- [ ] Evidence from all three operating systems is available from the T02 pull request before merge; checkout imports in Bun steps use absolute file URLs from `process.cwd()`, and failures retain nonzero exit codes.

## Task F00-T03 — Compare renderers and record the ADR-003 decision

<a id="task-f00-t03--spike-dua-renderer-dan-keputusan-adr-003"></a>

- **Type:** spike
- **Labels:** os:windows
- **Bergantung pada:** F00-T01
- **Files:**
  - Create: `spikes/renderer/package.json`, `spikes/renderer/bun.lock`, `spikes/renderer/compare.ts`, `spikes/renderer/compare.test.ts`, `spikes/renderer/minimal.ts`, `spikes/renderer/pi.ts`, `spikes/renderer/minimal-entry.ts`, `spikes/renderer/pi-entry.ts`, `docs/perf/renderer.md`
  - Modify: `docs/adr/003-renderer-tui.md`

### Langkah

- [ ] Ikuti [Task 3](../superpowers/plans/2026-11-08-fase-00-foundation.md#task-3-f00-t03--spike-renderer) untuk dua prototipe streaming/input, test kontrak, pengukuran, dan laporan keputusan.

### Verifikasi

`rtk bun test spikes/renderer/compare.test.ts` → lulus termasuk kontrol pi legacy/Kitty/modifyOtherKeys; kedua source entry dan kedua executable compiled diuji native Windows/Linux. Command lengkap dan workload identik ada pada Task 3 Step 6 di rencana.

### Selesai bila

- [ ] Both options are evaluated with the same workload, including their licenses and size impact; all eight OS × backend × source/compiled combinations record input, streaming, resize, exit, and terminal restoration, with both exit controls recorded. Successful builds alone do not establish compiled/native-helper compatibility. Interactive launches preserve stdin/stdout TTYs.
- [ ] Pi controls use `matchesKey` and retain terminal cleanup through `stop()`; the minimal raw backend preserves its documented byte contract.
- [ ] Recorded latency distinguishes render/write overhead from terminal input-to-paint latency.
- [ ] ADR-003 selects an option based on evidence; the spike does not implement the production TUI planned for Phase 9.

## Task F00-T04 — Add a lightweight CLI entry and compiled binary

<a id="task-f00-t04--entry-cli-ringan-dan-binary"></a>

- **Type:** feat
- **Labels:** os:windows
- **Bergantung pada:** F00-T02
- **Files:**
  - Create: `src/cli.ts`, `src/app.ts`, `scripts/build.ts`, `test/cli.test.ts`
  - Modify: `package.json`, `.github/workflows/ci.yml`

### Langkah

- [ ] Ikuti [Task 4](../superpowers/plans/2026-11-08-fase-00-foundation.md#task-4-f00-t04--cli-ringan-dan-build) untuk parser platform, exit code, lazy import, dan smoke binary.

### Verifikasi

`rtk bun test test/cli.test.ts`; `rtk bun run build` → lulus; binary native `--help`/`--version` sukses tanpa config/shell.

### Selesai bila

- [ ] Informational flags do not load zod, the renderer, models, or configuration.
- [ ] Invalid arguments exit with code 2, leave stdout empty, and explain usage on stderr.
- [ ] The native binary and source entry exhibit the same behavior.

## Task F00-T05 — Load global and project JSONC configuration

<a id="task-f00-t05--config-jsonc-global-dan-proyek"></a>

- **Type:** feat
- **Bergantung pada:** F00-T04
- **Files:**
  - Create: `src/config.ts`, `src/platform/config.ts`, `test/config.test.ts`
  - Modify: `src/app.ts`, `test/cli.test.ts`, `package.json`, `bun.lock`

### Langkah

- [ ] Ikuti [Task 5](../superpowers/plans/2026-11-08-fase-00-foundation.md#task-5-f00-t05--config-jsonc) untuk schema, merge tanpa default yang menimpa global, dan error tanpa isi secret.

### Verifikasi

`rtk bun test test/config.test.ts test/cli.test.ts` → lulus untuk JSONC/CRLF/BOM, file hilang, versi invalid, proyek menang.

### Selesai bila

- [ ] Empty configuration is valid and resolves to `version: 1`; other versions are rejected without speculative migrations.
- [ ] Existing configuration that is malformed or unreadable produces a clear error rather than being silently ignored.
- [ ] Only zod is added as a runtime dependency, as required by ADR-005; no additional parser is introduced.

## Task F00-T06 — Detect Git Bash and initialize normal startup

<a id="task-f00-t06--deteksi-git-bash-dan-startup-normal"></a>

- **Type:** feat
- **Labels:** os:windows
- **Bergantung pada:** F00-T05
- **Files:**
  - Create: `src/platform/shell.ts`, `test/shell.test.ts`
  - Modify: `src/app.ts`, `test/cli.test.ts`

### Langkah

- [ ] Ikuti [Task 6](../superpowers/plans/2026-11-08-fase-00-foundation.md#task-6-f00-t06--git-bash) untuk kandidat berurutan, pemeriksaan Git Bash asli, dan integration test.

### Verifikasi

`rtk bun test test/shell.test.ts test/cli.test.ts` → lulus; WSL launcher tidak dianggap Git Bash.

### Selesai bila

- [ ] Tests prove the resolution order: configuration, common Git installation paths, then PATH.
- [ ] An invalid explicit configuration produces an error rather than silently falling back; paths containing spaces work correctly.
- [ ] Windows startup without Git Bash reports the installation URL and the configuration field to set.

## Task F00-T07 — Mock OpenAI and Anthropic providers

<a id="task-f00-t07--mock-provider-openai-dan-anthropic"></a>

- **Type:** test
- **Bergantung pada:** F00-T01
- **Files:**
  - Create: `test/helpers/mock-provider.ts`, `test/mock-provider.test.ts`, `test/fixtures/providers/openai.json`, `test/fixtures/providers/anthropic.json`, `test/fixtures/providers/openai.sse`, `test/fixtures/providers/anthropic.sse`

### Langkah

- [ ] Ikuti [Task 7](../superpowers/plans/2026-11-08-fase-00-foundation.md#task-7-f00-t07--mock-provider) untuk fixture sintetis, server loopback, lifecycle, dan pengujian wire.

### Verifikasi

`rtk bun test test/mock-provider.test.ts` → endpoint kedua protokol, mode JSON/SSE, request capture dan shutdown lulus.

### Selesai bila

- [ ] The server binds to `127.0.0.1` with `port: 0`; tests never call a real provider.
- [ ] Payloads follow the correct protocol wire formats and use clearly fake credentials.
- [ ] Unknown requests return 404; each test owns isolated requests, responses, and server resources.

## Task F00-T08 — Enforce performance regression checks

<a id="task-f00-t08--pemeriksa-regresi-performa"></a>

- **Type:** perf
- **Labels:** os:windows
- **Bergantung pada:** F00-T02, F00-T06
- **Files:**
  - Create: `scripts/perf.ts`, `test/perf.test.ts`
  - Modify: `src/platform/process.ts`, `src/app.ts`, `package.json`, `.github/workflows/baseline.yml`

### Langkah

- [ ] Ikuti [Task 8](../superpowers/plans/2026-11-08-fase-00-foundation.md#task-8-f00-t08--pemeriksa-regresi-performa) untuk probe aplikasi yang sudah diinisialisasi dan pembanding tiga metrik.

### Verifikasi

`rtk bun test test/perf.test.ts` → tepat 20% lulus, >20% gagal; data hilang/invalid/beda lingkungan ditolak.

### Selesai bila

- [ ] All three metrics are checked independently, including binary size.
- [ ] The RSS measurement belongs to the child process after configuration and shell initialization, not to the measurement process.
- [ ] Mismatched local hosts, CPU models, core counts, RAM, runner classes, OS, architecture, Bun versions, or workloads are rejected; legacy keys without fingerprints are also rejected. Baseline fallbacks or missing baselines cannot make CI pass.

## Task F00-T09 — Approve measured baselines and require performance CI

<a id="task-f00-t09--baseline-disetujui-dan-job-perf-wajib"></a>

- **Type:** perf
- **Labels:** os:windows, spec-change
- **Bergantung pada:** F00-T03, F00-T07, F00-T08
- **Files:**
  - Create: `docs/perf/baseline.json`, `scripts/assemble-baseline.ts`
  - Modify: `test/perf.test.ts`, `docs/adr/006-gerbang-performa.md`, `docs/perf/measurement.md`, `.github/workflows/ci.yml`, `scripts/setup-github.sh`, `docs/WORKFLOW.md`

### Langkah

- [ ] Ikuti [Task 9](../superpowers/plans/2026-11-08-fase-00-foundation.md#task-9-f00-t09--baseline-dan-ci-perf) untuk mengumpulkan angka aktual, review baseline, job perf dan bukti injeksi regresi.

### Verifikasi

`rtk bun run perf` → exit 0 pada lingkungan matching; workflow pada perubahan regresi uji >20% → job perf exit nonzero.

### Selesai bila

- [ ] Baselines contain actual hello/agent measurements from all three operating systems, with matching keys and Bun versions per OS/runner class; local entries use the measurement machine's fingerprint. Baseline changes receive a `spec-change` review.
- [ ] Linux and Windows check and performance jobs run without skipping missing baseline input.
- [ ] Job names in `CHECKS` match CI; the user applies branch-protection changes.

## Task F00-T10 — Document usage and phase completion evidence

<a id="task-f00-t10--dokumentasi-pemakaian-dan-bukti-gerbang-fase"></a>

- **Type:** docs
- **Bergantung pada:** F00-T09
- **Files:**
  - Create: `README.md`, `docs/perf/fase-00-gate.md`
  - Modify: `README-KIT.md`, `docs/phases/fase-00.md`

### Langkah

- [ ] Ikuti [Task 10](../superpowers/plans/2026-11-08-fase-00-foundation.md#task-10-f00-t10--dokumentasi-dan-gerbang) untuk contoh penggunaan dan pencatatan semua bukti.

### Verifikasi

Jalankan seluruh daftar gerbang di atas; laporan memuat hasil tiap perintah, URL run CI, dan angka perf.

### Selesai bila

- [ ] The README explains the skeleton's current capabilities and build/check commands without claiming that model calls are implemented.
- [ ] Evidence covers all three operating systems, both mock protocols, both spikes, and the deliberately injected regression.
- [ ] The user retains control of milestone closure, releases, and merges; Phase 1 has not been executed.

## Laporan gerbang

Status saat spec ditulis: **belum dijalankan**. Tidak ada kode aplikasi atau baseline yang dibuat oleh pekerjaan perencanaan ini. Bukti implementasi akan dicatat oleh F00-T10 setelah sembilan task sebelumnya selesai dan hasil CI tersedia.

Koreksi rencana 8 November 2026 memperbaiki contoh Actions, trigger baseline, identitas lingkungan, kontrol/eksekusi compiled renderer, dan daftar file T05. Sepuluh ID task, dependensi dan keputusan ADR tetap. Verifikasi koreksi hanya mencakup dokumen dan pemeriksaan contoh terisolasi; tidak membuktikan benchmark, CI aplikasi, atau terminal native tiga OS. Detail perintah dan batas verifikasi ada pada bagian status verifikasi rencana.

Follow-up review corrected interactive launches to preserve TTYs and translated the task titles and acceptance text copied to GitHub. Explicit legacy anchors preserve existing issue links. English sources and the separately owned English issue wrapper must both be merged before live issue synchronization; no live update was run from this branch.
