# ADR-004: Git Bash sebagai shell tool di Windows

- **Status:** Diterima (revisi plan 8 Nov 2026)
- **Ditinjau di:** Fase 0

## Konteks

Tool `bash` harus jalan di Windows sebagai platform kelas satu. Model paling fasih dengan bash, dan parser izin (tree-sitter-bash) hanya mengenal satu grammar.

## Keputusan

Di Windows, tool `bash` memakai Git Bash. Resolusi path: config → lokasi instal Git umum → `PATH`. Tanpa Git Bash, CLI berhenti dengan pesan yang menjelaskan cara instal. Pembatalan/timeout membunuh pohon proses dengan `taskkill /T /F`.

## Konsekuensi

User Windows wajib memasang Git for Windows. Perintah khusus PowerShell tidak didukung di v0.x.

## Ditinjau ulang bila

Banyak user Windows tanpa Git, atau eval menunjukkan model sering gagal karena perbedaan Git Bash. Tool PowerShell native ada di backlog.
