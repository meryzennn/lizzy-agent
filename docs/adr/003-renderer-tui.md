# ADR-003: Renderer TUI diferensial model pi-tui, bukan Ink

- **Status:** Diterima (revisi plan 8 Nov 2026)
- **Ditinjau di:** Fase 0

## Konteks

Fase 15 menuntut diff per baris, frame CSI 2026, blok committed ke scrollback, dan latensi ketikan <16 ms. Ink memakai reconciler React + Yoga dan menggambar ulang area dinamis; model itu bertentangan dengan target tersebut.

## Keputusan

TUI memakai renderer diferensial: komponen `render(width): string[]`, diff baris, hanya rentang yang berubah dicat ulang, dibungkus CSI 2026. Spike Fase 0 memilih antara memakai paket pi-tui langsung (cek lisensi, ukuran, kecocokan API) atau menulis renderer minimal sendiri.

## Konsekuensi

Tidak ada ekosistem komponen React. Komponen (editor input, daftar, markdown) ditulis atau diambil dari pi-tui.

## Ditinjau ulang bila

Spike Fase 0 menunjukkan kedua opsi gagal memenuhi latensi atau ukuran. Hasil spike ditulis di bawah ini.

## Hasil spike Fase 0

F00-T03 selects an **owned minimal differential renderer** within the accepted design above. Both it and MIT-licensed `@earendil-works/pi-tui@1.5.0` completed native Windows/Linux source and compiled ASCII sessions, with 100 echoed inputs per exit control, zero unanswered inputs, streaming, submission, resize, and terminal restoration.

The owned prototype measured p95 below 0.13 ms in all sessions versus 12.98–16.03 ms for pi. Its JS bundle was 6,106 bytes versus 212,952 bytes; the independent compiled binaries were also about 200 KiB smaller. Pi's standalone Windows build ran the fixture without its optional native helper; restoring that helper requires an additional 8,704-byte asset and its packaging path. These findings favor owning the small renderer core without adding pi to production dependencies.

See [the reproducible comparison, raw samples, commands, sizes, and limitations](../perf/renderer.md). Windows evidence uses `77c97e95bab4b652435e37c11641c67f534e064f`; Linux uses `c0fc51b3f38c788fb79672db39f5eac17d426651` after a harness-only fork fix. The renderer sources are identical. Latency measures raw input receipt through the write containing its echo, not physical screen paint. This two-line ASCII spike does not implement or prove the Phase 9 editor, Unicode, scrollback, or production PTY latency gate.
