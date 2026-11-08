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

_(diisi di Fase 0)_
