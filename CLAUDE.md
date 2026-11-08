# CLAUDE.md

Proyek ini: coding agent CLI open-source, provider-agnostic, TypeScript + Bun, dibangun per fase (0–15). File ini aturan tetap untuk setiap sesi. Baca sampai habis sebelum bekerja.

## Sumber kebenaran

| Apa | Di mana | Isinya |
|---|---|---|
| Peta proyek | `docs/PLAN.md` (tampilan: `docs/PLAN.html`) | Fase, prinsip (bagian C), keputusan revisi (bagian R) |
| Keputusan arsitektur | `docs/adr/` | Yang sudah dikunci. Tidak boleh dilanggar tanpa ADR baru yang disetujui user |
| Spec fase aktif | `docs/phases/fase-NN.md` | Task `FNN-TMM`: files, langkah, verifikasi, "selesai bila" |
| Status kerja | GitHub Issues + milestone `FNN · …` | Satu issue per task. Issue menautkan ke spec, tidak menyalin langkahnya |
| Cara kerja git | `docs/WORKFLOW.md` | Branch, commit, PR, label, rilis |

Kalau sumber-sumber ini bertabrakan, urutannya: ADR > prinsip C di PLAN > fase MD > issue. Laporkan tabrakannya ke user; jangan memilih diam-diam.

## Keputusan terkunci (ringkas, detail di `docs/adr/`)

- **ADR-001** Bun-only. Tidak ada target Node.
- **ADR-002** Adapter HTTP sendiri untuk OpenAI-compatible dan Anthropic Messages. Jangan menambah Vercel AI SDK atau SDK provider.
- **ADR-003** Renderer TUI diferensial model pi-tui. Jangan menambah Ink/React.
- **ADR-004** Tool bash memakai Git Bash di Windows.
- **ADR-005** Semua config JSONC + zod. Jangan menambah parser YAML/TOML.
- **ADR-006** Gerbang performa sejak Fase 0: `--version`, idle RSS, ukuran binary vs `docs/perf/baseline.json`, regresi >20% = merah.

## Alur kerja wajib

1. **Jangan pernah commit ke `main`.** Mulai dari `git switch main && git pull --ff-only`, lalu branch:
   - task kode: `fNN/tMM-slug-pendek` (contoh `f06/t03-skema-combo`)
   - dokumen fase: `docs/fNN-slug` (contoh `docs/f06-rencana`)
2. **Satu issue = satu branch = satu PR.** Jangan gabungkan dua task. Temuan di luar scope → issue baru (`gh issue create`), bukan diselipkan.
3. **Commit kecil, Conventional Commits** dengan scope fase: `feat(f06): …`, `fix(f02): …`, `test(f07): …`, `docs(f06): …`, `chore: …`, `perf(f15): …`. Baris terakhir body: `Refs #N`.
4. **PR**: judul `<type>(fNN): <ringkasan> [FNN-TMM]`, body mengikuti `.github/pull_request_template.md`, wajib berisi `Closes #N`.
5. **CI**: `gh pr checks --watch`. Merah → perbaiki di branch yang sama. Windows merah tetap merah, tidak boleh diabaikan atau di-skip.
6. **Yang bukan tugasmu**: merge PR, menutup issue secara manual, membuat tag atau rilis, mengubah proteksi branch. Itu dilakukan user.
7. **Setelah PR dibuka dan CI hijau: lapor, lalu berhenti.** Jangan mulai issue berikutnya tanpa diminta.
8. Force push hanya ke branch sendiri dengan `--force-with-lease`, dan hanya sebelum user mulai review. Tidak pernah ke `main`.

## Kapan berhenti dan bertanya

Berhenti, komentar di issue (`gh issue comment N`), tambahkan label `status:needs-decision`, lalu lapor ke user bila:

- spec di fase MD atau issue ambigu, salah, atau tidak bisa dijalankan;
- butuh dependensi runtime baru (`dependencies` di package.json) — tulis alasan dan dampaknya ke ukuran/startup;
- test yang sudah ada tampak salah;
- perubahan menyentuh ADR atau prinsip C;
- pekerjaan menyeret fase yang belum aktif.

Memperbaiki spec dilakukan lewat PR docs terpisah, bukan diam-diam di PR kode.

## Perintah

```bash
bun install
bun run check        # typecheck + lint + test — wajib hijau sebelum push
bun test <path>      # test spesifik
bun run build        # binary bun build --compile
bun run perf         # ukur --version, idle RSS, ukuran binary vs docs/perf/baseline.json
bun scripts/sync-issues.ts docs/phases/fase-NN.md --dry-run
```

Skrip `check`, `build`, dan `perf` dibuat di Fase 0. Sebelum ada, jangan mengaku sudah menjalankannya.

## Aturan kode

- TypeScript strict. `any` hanya dengan komentar alasan.
- stdout hanya untuk output hasil/terstruktur; semua log dan diagnostik ke stderr.
- Entry CLI harus ringan: dependensi berat (MCP SDK, tree-sitter, tiktoken, katalog model) di-import malas dengan `await import()`.
- Akses OS (fs, spawn, path, shell, sinyal) lewat modul `src/platform/`, tidak dipanggil berserakan, supaya perilaku Windows bisa diuji.
- Jangan menyusun path dengan string `/`; pakai helper path. Saat mengedit file user, pertahankan gaya newline (CRLF/LF) dan BOM.
- Tidak ada secret di kode, test, fixture, atau log. Fixture memakai kunci palsu yang jelas palsu.
- Pesan error ke user harus bisa ditindaklanjuti: apa yang salah dan cara memperbaikinya.

## Aturan test

- Tulis atau ubah test bersama kode. Untuk bug: buat test yang gagal dulu.
- **Jangan pernah** melemahkan, menghapus, men-skip (`.skip`, `.todo`, `.only`, exclude) test yang sudah ada supaya lulus. Kalau test-nya salah: berhenti dan lapor.
- `bun test` tidak boleh menyentuh jaringan atau provider asli; pakai mock provider server. Eval dengan model asli ada di `evals/` dan dijalankan terpisah.
- Test harus lintas platform: jangan asumsikan `/tmp`, `sh`, separator `/`, atau LF.
- Fixture CRLF diletakkan di `test/fixtures/**/crlf/` (dijaga `.gitattributes`).

## Definisi selesai sebuah task

- Semua poin "Selesai bila" di issue terpenuhi dan dibuktikan dengan perintah yang benar-benar dijalankan.
- `bun run check` hijau lokal; CI Linux + Windows hijau.
- Job perf tidak regresi >20%. Kalau regresi disengaja: jelaskan di PR dan minta persetujuan sebelum memperbarui baseline.
- Dokumen yang terdampak (README, skema, ADR, fase MD) ikut diperbarui.

## Format laporan ke user

1. Issue dan PR (link).
2. Yang dikerjakan, 1–3 kalimat.
3. Bukti verifikasi: perintah yang dijalankan + ringkasan output.
4. Yang tidak dikerjakan, risiko, atau pertanyaan terbuka.

Jangan mengklaim sesuatu lulus tanpa output yang membuktikannya.
