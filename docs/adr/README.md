# Architecture Decision Records

Keputusan yang sudah dikunci. Mengubahnya butuh ADR baru (atau perubahan status ADR lama) lewat PR berlabel `spec-change`, disetujui user.

| ADR | Keputusan |
|---|---|
| [001](001-runtime-bun-only.md) | Runtime Bun-only |
| [002](002-adapter-http-sendiri.md) | Adapter HTTP sendiri, tanpa AI SDK |
| [003](003-renderer-tui.md) | Renderer TUI diferensial model pi-tui, bukan Ink |
| [004](004-shell-windows.md) | Git Bash sebagai shell tool di Windows |
| [005](005-config-jsonc.md) | Semua config JSONC |
| [006](006-gerbang-performa.md) | Gerbang performa sejak Fase 0; CI reference selection partially replaced by ADR-007 |
| [007](007-paired-ci-reference.md) | Paired native CI against immutable T08; historical local mode preserved |

Format ADR baru: salin salah satu file, nomor berikutnya, isi Status / Konteks / Keputusan / Konsekuensi / Ditinjau ulang bila.
