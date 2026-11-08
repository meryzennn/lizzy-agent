---
description: Tulis docs/phases/fase-NN.md untuk satu fase, lalu buka PR docs
argument-hint: <nomor fase, mis. 06>
---

Fase target: **$ARGUMENTS** (tulis sebagai dua digit, `NN`).

Write every GitHub issue/PR title, body, and authored discussion or comment in English regardless of the chat language. Write phase/task titles and acceptance prose copied by `sync-issues` in English too; retain parser headings, IDs, sync markers, and existing link anchors.

1. **Cek gerbang sebelumnya.** Untuk fase > 00: pastikan milestone fase sebelumnya sudah tertutup
   (`gh api "repos/{owner}/{repo}/milestones?state=all" --jq '.[] | [.title, .state] | @tsv'`)
   dan `docs/phases/fase-<NN-1>.md` punya "Laporan gerbang" yang lulus. Kalau belum: berhenti dan lapor.
2. **Baca konteks:** `CLAUDE.md`, bagian "Fase $ARGUMENTS" serta bagian R dan C di `docs/PLAN.md`,
   semua `docs/adr/`, `docs/phases/_TEMPLATE.md`, dan struktur kode yang ada (`src/`, `test/`, `package.json`).
   Baca kode yang akan disentuh fase ini, jangan menebak API yang sudah ada.
3. **Tulis `docs/phases/fase-NN.md`** persis mengikuti template:
   - Pecah tugas PLAN menjadi task `FNN-T01`, `FNN-T02`, … berurutan. Satu task ≤ ~400 baris diff.
   - Setiap task: Type, Labels, Bergantung pada, Files (Create/Modify/Test), Langkah berbentuk checkbox dengan
     kode test dan implementasi yang presisi, perintah verifikasi + output yang diharapkan, dan "Selesai bila".
   - Spike di PLAN menjadi task `type: spike` di urutan paling awal; task yang bergantung padanya mencantumkannya.
   - Task yang menyentuh perilaku khusus Windows diberi label `os:windows`. Fase 6, 7, 13 diberi label `pembeda`.
   - "Kriteria selesai fase" ditulis sebagai perintah yang bisa dijalankan.
   - Tidak ada placeholder ("TODO", "tambahkan test yang sesuai", "dst.").
4. **Jangan menulis kode produksi** di langkah ini.
5. Validasi format: `bun scripts/sync-issues.ts docs/phases/fase-NN.md --dry-run`
   (sebelum Fase 0 selesai dan Bun belum ada di repo, cukup cek heading `## Task FNN-TMM — …` manual).
6. Branch `docs/fNN-rencana`, commit `docs(fNN): rencana fase NN`, push, buka PR dengan label `type:docs` dan `phase:FNN`.
7. Laporkan ringkasan: jumlah task, urutan dan dependensinya, spike yang ada, dan hal di PLAN yang menurutmu
   bermasalah atau perlu keputusan. Lalu **berhenti** dan tunggu user me-review dan merge.
