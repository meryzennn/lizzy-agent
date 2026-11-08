# Fase NN — Judul fase

> **Goal:** satu kalimat, diambil dari bagian D di `docs/PLAN.md`.
> **Architecture:** 2–4 kalimat: modul yang dibuat/diubah dan bagaimana menempel ke yang sudah ada.
> **Tech stack:** hanya yang relevan untuk fase ini, sesuai ADR.
> **Plan:** `docs/PLAN.md` → "Fase NN".

<!--
ATURAN TEMPLATE (dibaca oleh scripts/sync-issues.ts — jangan ubah formatnya)
- Setiap task diawali heading level 2 persis: "## Task FNN-TMM — Judul task"
  (NN dua digit fase, MM dua digit urut, pemisah em dash "—" atau "-").
- Baris "- **Type:**" wajib: feat | fix | test | docs | perf | spike | chore.
- Baris "- **Labels:**" opsional, dipisah koma (mis. pembeda, os:windows).
- Baris "- **Bergantung pada:**" berisi ID task (F06-T01, F06-T02) atau "—".
- Subbagian "### Selesai bila" disalin ke issue. Langkah dan kode TIDAK disalin; issue menautkan ke sini.
- Task ≤ ~400 baris diff. Pecah bila lebih besar.
- Spike: type spike, keluarannya dokumen/angka, bukan kode produksi.
-->

## Kriteria selesai fase (gerbang)

Salin dari PLAN, lalu tulis tiap poin sebagai perintah yang bisa dijalankan:

- [ ] `perintah` → output yang diharapkan
- [ ] …

## Task FNN-T01 — Judul task pertama

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
- [ ] Commit: `feat(fNN): …`

### Verifikasi

```bash
bun test test/…
```

Output yang diharapkan:

```
… pass
```

### Selesai bila

- [ ] Perilaku X terbukti oleh test `…`.
- [ ] Jalan di Windows dan Linux (CI).
- [ ] Tidak ada dependensi runtime baru.

## Task FNN-T02 — Judul task berikutnya

- **Type:** test
- **Bergantung pada:** FNN-T01
- **Files:**
  - Test: `test/…`

### Langkah

- [ ] …

### Selesai bila

- [ ] …

## Laporan gerbang

Diisi oleh `/gerbang-fase NN`: tiap kriteria, perintah yang dijalankan, ringkasan output, hasil eval (bila relevan), dan angka perf dibanding baseline.
