---
description: Buat/perbarui satu issue per task dari docs/phases/fase-NN.md
argument-hint: <nomor fase, mis. 06> [--update]
---

Argumen: **$ARGUMENTS**

1. `git switch main && git pull --ff-only`. Pastikan `docs/phases/fase-NN.md` sudah ada di `main`
   (artinya PR rencana sudah di-merge). Kalau belum: berhenti dan lapor.
2. Jalankan dry-run dan tunjukkan hasilnya ke user:
   `bun scripts/sync-issues.ts docs/phases/fase-NN.md --dry-run`
3. Kalau formatnya benar, jalankan tanpa `--dry-run` (tambahkan `--update` bila argumen memintanya,
   yaitu setelah spec berubah dan isi issue yang masih terbuka perlu diperbarui).
4. Laporkan daftar issue yang dibuat/diperbarui/dilewati beserta nomornya. Jangan mulai mengerjakan issue.
