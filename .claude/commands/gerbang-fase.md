---
description: Buktikan kriteria selesai satu fase dan tulis laporan gerbang
argument-hint: <nomor fase, mis. 06>
---

Fase: **$ARGUMENTS**

Write every GitHub issue/PR title, body, and authored discussion or comment in English regardless of the chat language. Keep phase/task titles and acceptance prose copied by `sync-issues` in English, preserving parser headings, IDs, sync markers, and existing link anchors.

1. `git switch main && git pull --ff-only`.
2. Pastikan semua issue di milestone fase ini tertutup
   (`gh issue list --milestone "<judul>" --state open`). Kalau masih ada: sebutkan, lalu berhenti.
3. Jalankan **setiap** kriteria di "Kriteria selesai fase" pada `docs/phases/fase-NN.md` dan bagian fase ini di
   `docs/PLAN.md`. Catat perintah dan ringkasan output tiap kriteria. Yang tidak bisa dibuktikan otomatis
   (mis. uji manual Windows, Discord asli) ditulis sebagai checklist manual untuk user, bukan ditandai lulus.
4. Jalankan `bun run check` dan `bun run perf`; bandingkan dengan `docs/perf/baseline.json`.
5. Bila fase ini menyentuh prompt, tool, atau loop agent: jalankan eval harness (setelah Fase 2 tersedia)
   dan bandingkan dengan hasil terakhir di `docs/evals/`.
6. Tulis hasilnya di bagian "Laporan gerbang" `docs/phases/fase-NN.md` (dan file hasil eval bila ada).
   Branch `docs/fNN-gerbang`, commit `docs(fNN): laporan gerbang`, PR.
7. Laporkan: lulus / tidak lulus per kriteria, checklist manual untuk user, regresi perf atau eval,
   dan apakah fase ini batas rilis (lihat tabel rilis di `docs/WORKFLOW.md`). Jangan menutup milestone
   dan jangan membuat tag — itu tugas user.
