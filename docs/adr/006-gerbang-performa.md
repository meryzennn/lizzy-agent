# ADR-006: Gerbang performa sejak Fase 0

- **Status:** Diterima (revisi plan 8 Nov 2026)
- **Ditinjau di:** Fase 0

**9 November 2026 amendment:** [ADR-007](007-paired-ci-reference.md) partially replaces CI reference selection with an immutable T08 reference measured alongside the candidate in each native job. The original decision and historical evidence below remain preserved. Local `bun run perf` still uses frozen `docs/perf/baseline.json`; the >20% rule, independent binary caps and review requirements remain in force. Native paired CI validation is pending in T09.

## Konteks

Budget performa (cold start, RSS, ukuran binary) semula baru jadi gerbang di Fase 15, setelah semua dependensi masuk. Ukuran binary kosong `bun build --compile` sendiri belum pernah diukur, jadi target 60 MB adalah tebakan.

## Keputusan

Fase 0 mengukur baseline hello-world di Linux, Windows, dan macOS ke `docs/perf/baseline.json`. CI menjalankan job perf di setiap PR: waktu `--version`, idle RSS, ukuran binary; regresi >20% dari baseline = merah. Target absolut binary ditetapkan dari baseline. Latensi TUI masuk gerbang di Fase 9.

## Konsekuensi

Setiap dependensi runtime baru harus dibenarkan di issue. Memperbarui baseline butuh persetujuan user di PR berlabel `spec-change`.

## Ditinjau ulang bila

Variasi runner CI terlalu besar sehingga gerbang 20% sering merah palsu; ganti ke median beberapa run atau runner tetap.

## Baseline Fase 0

_(diisi di Fase 0)_
