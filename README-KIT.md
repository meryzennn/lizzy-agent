# Paket starter: plan + aturan Claude Code

Isi paket ini disalin ke root repo baru sebelum Fase 0. Setelah itu file ini boleh dihapus.

| File | Fungsi |
|---|---|
| `CLAUDE.md` | Aturan tetap yang dibaca Claude Code di setiap sesi |
| `docs/PLAN.html`, `docs/PLAN.md` | Plan revisi 8 Nov 2026 (HTML untuk dibaca, MD untuk Claude Code) |
| `docs/adr/` | Enam keputusan arsitektur yang dikunci |
| `docs/WORKFLOW.md` | Spec vs issue, branch, commit, PR, label, rilis |
| `docs/phases/_TEMPLATE.md` | Format file spec per fase (dibaca skrip sinkron) |
| `.claude/commands/` | `/fase-rencana`, `/sinkron-issue`, `/kerjakan`, `/gerbang-fase` |
| `.claude/settings.json` | Izin: perintah rutin diizinkan; merge, tag, force push, push ke main ditolak |
| `.github/` | Template PR dan issue, CI starter Linux + Windows |
| `scripts/setup-github.sh` | Label, milestone F00–F15, squash-only, proteksi `main` |
| `scripts/sync-issues.ts` | Satu issue per task dari `docs/phases/fase-NN.md` |

## Setup sekali (±10 menit)

Kebutuhan: Git (di Windows: Git for Windows, yang membawa Git Bash), [Bun](https://bun.sh), GitHub CLI `gh`, Claude Code.

```bash
# 1. Repo baru (public: proteksi branch gratis)
gh repo create nama-agent --public --clone
cd nama-agent

# 2. Salin isi paket ini ke sini, lalu commit pertama langsung ke main
#    (satu-satunya commit yang boleh langsung ke main)
git config core.autocrlf false
git add -A
git commit -m "chore: paket starter plan dan alur kerja"
git push -u origin main

# 3. Label, milestone, setelan merge, proteksi main
bash scripts/setup-github.sh
```

## Siklus kerja dengan Claude Code

Buka Claude Code di root repo, lalu:

```
/fase-rencana 00      → PR berisi docs/phases/fase-00.md   → kamu review & squash-merge
/sinkron-issue 00     → issue F00-T01, F00-T02, … di milestone F00
/kerjakan             → satu issue → branch → PR, CI hijau → kamu review & squash-merge
/kerjakan             → ulangi sampai milestone kosong
/gerbang-fase 00      → PR laporan gerbang                  → kamu merge, tutup milestone
/fase-rencana 01      → dan seterusnya
```

Di batas rilis (setelah Fase 3, 7, 10, 11, 13, 14, 15) kamu membuat tag; lihat `docs/WORKFLOW.md` bagian 8.

## Prompt pembuka sesi pertama

```
Baca CLAUDE.md, docs/WORKFLOW.md, docs/adr/, dan bagian R, C, serta Fase 0 di docs/PLAN.md.
Jangan menulis kode dulu. Ringkas dalam 10 baris apa yang akan kamu lakukan di Fase 0,
lalu jalankan /fase-rencana 00.
```

## Setelah Fase 0

Fase 0 menambah job perf ke CI. Tambahkan nama job itu ke `CHECKS` di `scripts/setup-github.sh`, lalu jalankan ulang skrip supaya job perf menjadi status check wajib.
