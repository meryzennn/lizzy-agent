# ADR-005: Semua config JSONC

- **Status:** Diterima (revisi plan 8 Nov 2026)
- **Ditinjau di:** Fase 0

## Konteks

Versi awal plan mencampur JSON, TOML, dan YAML untuk config.

## Keputusan

Config global dan proyek memakai JSONC (JSON dengan komentar), divalidasi zod, dengan field `version` untuk migrasi. Tema tetap JSON murni.

## Konsekuensi

Tidak ada dependensi parser YAML/TOML. Contoh di dokumentasi semuanya JSONC.

## Ditinjau ulang bila

—
