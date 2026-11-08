# Fase NN — Judul fase

> **Goal:** satu kalimat, diambil dari bagian D di `docs/PLAN.md`.
> **Architecture:** 2–4 kalimat: modul yang dibuat/diubah dan bagaimana menempel ke yang sudah ada.
> **Tech stack:** hanya yang relevan untuk fase ini, sesuai ADR.
> **Plan:** `docs/PLAN.md` → "Fase NN".

<!--
ATURAN TEMPLATE (dibaca oleh scripts/sync-issues.ts — jangan ubah formatnya)
- Setiap task diawali heading level 2 persis: "## Task FNN-TMM — Task title"
  (NN dua digit fase, MM dua digit urut, pemisah em dash "—" atau "-").
- Baris "- **Type:**" wajib: feat | fix | test | docs | perf | spike | chore.
- Baris "- **Labels:**" opsional, dipisah koma (mis. pembeda, os:windows).
- Baris "- **Bergantung pada:**" berisi ID task (F06-T01, F06-T02) atau "—".
- Subbagian "### Selesai bila" disalin ke issue. Langkah dan kode TIDAK disalin; issue menautkan ke sini.
- All GitHub issue and PR titles/bodies must be English. Write task heading titles and all acceptance text copied from "### Selesai bila" in English; keep parser delimiters "# Fase", "- **Bergantung pada:**", and "### Selesai bila" unchanged.
- When translating an existing heading, preserve its published slug with an explicit HTML anchor immediately below that heading so old issue/PR links continue to resolve. Keep anchors outside acceptance sections so sync-issues does not copy them into another task's issue.
- Task ≤ ~400 baris diff. Pecah bila lebih besar.
- Spike: type spike, keluarannya dokumen/angka, bukan kode produksi.
-->

## Kriteria selesai fase (gerbang)

Salin dari PLAN, lalu tulis tiap poin sebagai perintah yang bisa dijalankan:

- [ ] `perintah` → output yang diharapkan
- [ ] …

## Task FNN-T01 — Implement the first task

- **Type:** feat
- **Labels:** os:windows
- **Bergantung pada:** —
- **Files:**
  - Create: `src/…`
  - Modify: `src/…`
  - Test: `test/…`

### Langkah

- [ ] Tulis test yang gagal: `test/…` (isi test lengkap di sini, bukan "tambahkan test").
- [ ] Jalankan `bun test test/…` → gagal dengan pesan `…`.
- [ ] Implementasi minimal di `src/…` (kode lengkap atau potongan yang presisi).
- [ ] Jalankan `bun test test/…` → lulus.
- [ ] `bun run check` → hijau.
- [ ] Commit: `feat(fNN): implement the task behavior` (use English for the PR title/body and retain the real issue reference).

### Verifikasi

```bash
bun test test/…
```

Output yang diharapkan:

```
… pass
```

### Selesai bila

- [ ] Tests verify the specified behavior.
- [ ] Windows and Linux CI pass.
- [ ] No new runtime dependencies are introduced.

## Task FNN-T02 — Test the next task

- **Type:** test
- **Bergantung pada:** FNN-T01
- **Files:**
  - Test: `test/…`

### Langkah

- [ ] …

### Selesai bila

- [ ] Tests cover the task's acceptance criteria and pass on Windows and Linux.

## Laporan gerbang

Diisi oleh `/gerbang-fase NN`: tiap kriteria, perintah yang dijalankan, ringkasan output, hasil eval (bila relevan), dan angka perf dibanding baseline.
