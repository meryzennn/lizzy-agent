# Alur kerja: spec, issue, branch, PR, rilis

Dokumen ini menjelaskan cara proyek dikerjakan, oleh kamu maupun Claude Code. Aturan ringkasnya ada di `CLAUDE.md`; di sini alasannya.

## 1. Spec di file MD, status di Issues

Keduanya dipakai, dengan peran berbeda. Isinya tidak diduplikasi.

| | File MD di repo | GitHub Issues |
|---|---|---|
| Peran | Spesifikasi: apa yang dibangun dan bagaimana membuktikannya | Status: siapa mengerjakan apa, sudah sampai mana |
| Isi | Goal, arsitektur, task `FNN-TMM` lengkap dengan files, langkah, perintah verifikasi | Judul task, link ke bagian spec, "Selesai bila", dependensi, diskusi |
| Berubah lewat | PR (ter-review, berversi, bisa di-diff) | Komentar, label, ditutup otomatis oleh PR |
| Dibaca Claude Code | Langsung dari disk, offline | Lewat `gh` |

Kenapa tidak MD saja: kamu tidak bisa melihat progres sekilas, PR tidak bisa menutup checkbox di file, dan tidak ada tempat diskusi per task. Kenapa tidak Issues saja: spec yang hidup di issue tidak berversi, tidak ikut ter-review bersama kode, dan Claude Code harus mengambilnya lewat jaringan setiap kali.

Aturannya: **kalau spec perlu berubah, ubah MD-nya lewat PR docs dulu**, lalu jalankan `bun scripts/sync-issues.ts docs/phases/fase-NN.md --update` supaya isi issue yang masih terbuka ikut diperbarui.

### File MD per fase ditulis tepat waktu

`docs/phases/fase-NN.md` ditulis saat fase NN akan dimulai, setelah fase sebelumnya lulus gerbang, berdasarkan kode yang sudah ada. Spec Fase 14 yang ditulis sebelum Fase 1 punya kode pasti basi. Template: `docs/phases/_TEMPLATE.md`.

### Ukuran task

Satu task kira-kira cukup untuk satu PR yang bisa direview dalam sekali duduk: target ≤ ~400 baris diff di luar fixture dan file yang digenerate. Tugas di PLAN yang lebih besar dipecah jadi beberapa task saat fase MD ditulis.

### GitHub Projects (opsional)

Milestone + label sudah cukup untuk proyek solo. Kalau mau papan visual: buat satu Project dengan view Board dikelompokkan per Status dan filter `milestone:"F06 · …"`. Tambahkan issue ke Project secara otomatis lewat workflow bawaan Project ("Auto-add to project", filter `is:issue`). Project tidak menggantikan milestone.

## 2. Kenapa PR + squash merge, bukan merge langsung

**Selalu lewat PR, lalu squash merge.** Tidak ada merge lokal ke `main`, tidak ada push langsung ke `main`.

- **CI Windows hanya berjalan sebelum masuk kalau lewat PR.** Prinsip "Windows kelas satu" tidak ada artinya kalau kode bisa masuk `main` tanpa melewati runner Windows.
- **PR adalah titik review kamu atas kerja Claude Code.** Diff, hasil CI, dan laporan verifikasi ada di satu tempat sebelum masuk.
- **Squash membuat `main` berisi satu commit per task** dengan judul `feat(f06): skema combo di config [F06-T03] (#57)`. Mudah dibaca, mudah di-revert per task, dan changelog bisa digenerate dari judulnya. Commit-commit kecil di branch tetap tersimpan di PR.
- **Merge commit dan rebase-merge dimatikan** supaya riwayat `main` linear dan seragam.

Yang tidak dipakai: stacked PR (fase berjalan berurutan, satu task aktif dalam satu waktu) dan merge queue (overkill untuk satu orang).

## 3. Branch

| Jenis | Pola | Contoh |
|---|---|---|
| Task kode | `fNN/tMM-slug` | `f06/t03-skema-combo` |
| Spec/laporan fase | `docs/fNN-slug` | `docs/f06-rencana`, `docs/f06-gerbang` |
| Bug di luar task | `fix/NNN-slug` (NNN = nomor issue) | `fix/88-crlf-edit` |
| Infrastruktur repo | `chore/slug` | `chore/ci-cache` |

Branch selalu dibuat dari `main` terbaru dan dihapus otomatis setelah merge. Kalau `main` bergerak saat PR masih terbuka: `git fetch && git rebase origin/main`, lalu `git push --force-with-lease` (hanya branch sendiri).

## 4. Commit

Conventional Commits dengan scope fase:

```
feat(f06): normalisasi blok thinking saat pindah provider

Blok thinking bersignature dibuang bila provider tujuan bukan Anthropic.
ID tool call dipetakan ulang ke format target.

Refs #61
```

Tipe: `feat`, `fix`, `test`, `docs`, `perf`, `refactor`, `chore`, `ci`. Commit kecil dan bermakna; tidak perlu sempurna karena akan di-squash, tapi membantu review.

## 5. Pull request

- Judul: `<type>(fNN): <ringkasan> [FNN-TMM]` — ini yang jadi commit di `main` setelah squash.
- Body: template `.github/pull_request_template.md`, wajib `Closes #N`.
- Status check wajib: `check (ubuntu-latest)`, `check (windows-latest)`, dan job perf setelah Fase 0 menambahkannya.
- Review: kamu. Claude Code tidak pernah merge.
- PR yang mengubah ADR, prinsip, atau baseline performa diberi label `spec-change` dan dijelaskan di body.

## 6. Label dan milestone

Dibuat oleh `scripts/setup-github.sh`.

- `phase:F00` … `phase:F15`
- `type:feat`, `type:fix`, `type:test`, `type:docs`, `type:perf`, `type:spike`, `type:chore`
- `pembeda` — task di fase pembeda (6, 7, 13)
- `os:windows` — perilaku khusus Windows
- `status:blocked`, `status:needs-decision`
- `spec-change`

Milestone: satu per fase, judul `F06 · Hard budget dan combo fallback`. Milestone ditutup setelah gerbang fase lulus.

## 7. Siklus satu fase

1. **Rencana** — `/fase-rencana NN` di Claude Code → PR `docs/fNN-rencana` berisi `docs/phases/fase-NN.md`. Kamu review dan merge.
2. **Issue** — `/sinkron-issue NN` → satu issue per task di milestone `FNN`.
3. **Eksekusi** — `/kerjakan` berulang, satu issue per sesi atau per perintah. Tiap PR kamu review dan squash-merge.
4. **Gerbang** — `/gerbang-fase NN` → kriteria selesai dibuktikan, eval dijalankan bila relevan, laporan masuk lewat PR `docs/fNN-gerbang`. Kamu menutup milestone.
5. **Rilis** (hanya di batas peta rilis) — kamu yang membuat tag.

## 8. Rilis dan tag

| Setelah gerbang | Tag |
|---|---|
| Fase 3 | `v0.1.0` |
| Fase 7 | `v0.2.0` |
| Fase 10 | `v0.3.0` |
| Fase 11 | `v0.4.0` |
| Fase 13 | `v0.5.0` |
| Fase 14 | `v0.6.0` |
| Fase 15 | `v0.7.0` |

```bash
git switch main && git pull --ff-only
git tag -a v0.1.0 -m "v0.1.0: Fase 0–3"
git push origin v0.1.0
gh release create v0.1.0 --generate-notes
```

Perbaikan setelah rilis memakai versi patch (`v0.1.1`) dari `main`; tidak ada branch rilis terpisah sebelum v1.

## 9. Windows dan git

- `.gitattributes` menormalisasi teks ke LF di repo, kecuali skrip Windows dan fixture CRLF di `test/fixtures/**/crlf/` yang dibiarkan apa adanya.
- Di mesin Windows: `git config core.autocrlf false` supaya `.gitattributes` yang berlaku, bukan setelan global.
- Jalur panjang di worktree (Fase 11): `git config core.longpaths true`.

## 10. Proteksi branch

`scripts/setup-github.sh` memasang proteksi `main`: wajib PR (0 approval, karena kamu tidak bisa meng-approve PR sendiri), status check wajib, riwayat linear, tanpa force push dan tanpa hapus. Di repo **privat** dengan akun GitHub gratis, proteksi branch tidak tersedia; di situ yang menjaga adalah aturan deny di `.claude/settings.json` dan disiplin kamu.
