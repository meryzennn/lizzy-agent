---
description: Kerjakan satu issue task sampai PR dibuka dan CI hijau
argument-hint: [nomor issue, opsional]
---

Issue yang diminta: **$ARGUMENTS** (kosong = pilih otomatis).

Write every GitHub issue/PR title, body, and authored discussion or comment in English regardless of the chat language. Keep any phase/task titles and acceptance prose copied by `sync-issues` in English, preserving parser headings, IDs, sync markers, and existing link anchors.

1. **Mulai bersih.** `git status` harus bersih. `git switch main && git pull --ff-only`.
2. **Pilih issue.** Kalau argumen kosong: ambil milestone fase aktif (milestone terbuka dengan nomor fase terkecil),
   lalu issue terbuka dengan ID task terkecil yang tidak berlabel `status:blocked`/`status:needs-decision`
   dan semua dependensinya sudah tertutup:
   `gh issue list --milestone "<judul milestone>" --state open --json number,title,labels,body`
3. **Baca spec.** `gh issue view N`, lalu bagian task-nya di `docs/phases/fase-NN.md` dan file yang disebut di Files.
   Kalau spec ambigu, salah, atau butuh dependensi runtime baru: `gh issue comment N`, tambah label
   `status:needs-decision` (`gh issue edit N --add-label status:needs-decision`), lapor, berhenti.
4. **Branch** `fNN/tMM-slug` dari `main`.
5. **Kerjakan langkah demi langkah** sesuai spec. Test dulu bila memungkinkan. Commit kecil,
   Conventional Commits, baris terakhir `Refs #N`. Jangan mengubah apa pun di luar scope task.
6. **Verifikasi lokal**: perintah verifikasi di spec + `bun run check` (+ `bun run perf` bila ada).
   Simpan ringkasan output untuk PR. Jangan mengaku lulus tanpa menjalankannya.
7. **PR**: `git push -u origin <branch>`, lalu
   `gh pr create --title "<type>(fNN): <English summary> [FNN-TMM]" --body-file <file>` dengan isi template PR
   dan `Closes #N`; label `phase:FNN` + type.
8. **CI**: `gh pr checks --watch`. Merah → baca log (`gh run view --log-failed`), perbaiki di branch yang sama,
   push lagi. Maksimal 3 putaran perbaikan; setelah itu lapor dengan diagnosis.
9. **Laporan** sesuai format di `CLAUDE.md`. **Jangan merge. Jangan lanjut ke issue berikutnya.**
