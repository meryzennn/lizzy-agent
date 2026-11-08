# ADR-001: Runtime Bun-only

- **Status:** Diterima (revisi plan 8 Nov 2026)
- **Ditinjau di:** Fase 0

## Konteks

Versi awal plan menjanjikan kompatibilitas Node ≥22, tapi plan yang sama memakai `Bun.serve`, `bun:sqlite`, `bun:jsc`, dan `Bun.connect`, dan tidak ada CI yang menjalankan Node. Distribusi utamanya binary `bun build --compile`.

## Keputusan

Proyek ini Bun-only. API khusus Bun boleh dipakai. Akses OS tetap lewat `src/platform/` supaya mudah diuji dan diganti.

## Konsekuensi

Tidak ada matriks CI Node. Pengguna npm tanpa Bun tidak didukung di v0.x. Kompatibilitas Node ada di backlog.

## Ditinjau ulang bila

Ada kebutuhan nyata distribusi via npm tanpa Bun.
