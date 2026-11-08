#!/usr/bin/env bash
# Siapkan repo GitHub: label, milestone per fase, setelan merge, proteksi main.
# Aman dijalankan ulang. Butuh: gh (sudah `gh auth login`), dijalankan dari dalam repo.
# Windows: jalankan dari Git Bash.
set -euo pipefail

command -v gh >/dev/null || { echo "gh tidak ditemukan. Instal GitHub CLI dulu." >&2; exit 1; }
gh auth status >/dev/null 2>&1 || { echo "Belum login. Jalankan: gh auth login" >&2; exit 1; }

REPO="$(gh repo view --json nameWithOwner --jq .nameWithOwner)"
echo "Repo: $REPO"

# ---------- label ----------
label() { # nama warna deskripsi
  gh label create "$1" --color "$2" --description "$3" --force >/dev/null
  echo "  label  $1"
}
echo "Label:"
for n in $(seq -w 0 15); do label "phase:F$n" "1d4ed8" "Fase $((10#$n))"; done
label "type:feat"   "0e8a16" "Fitur baru"
label "type:fix"    "d73a4a" "Perbaikan bug"
label "type:test"   "c5def5" "Test saja"
label "type:docs"   "0075ca" "Dokumen / spec"
label "type:perf"   "fbca04" "Performa"
label "type:spike"  "d4c5f9" "Eksperimen terbatas waktu; keluarannya angka/dokumen"
label "type:chore"  "ededed" "Infrastruktur repo"
label "pembeda"     "b34700" "Fase pembeda (6, 7, 13)"
label "os:windows"  "0078d4" "Perilaku khusus Windows"
label "status:blocked"         "b60205" "Terblokir dependensi lain"
label "status:needs-decision"  "e99695" "Butuh keputusan user sebelum lanjut"
label "spec-change" "5319e7" "Mengubah PLAN, ADR, atau baseline performa"

# ---------- milestone ----------
TITLES=(
  "F00 · Skeleton repo dan harness"
  "F01 · Model layer dan provider"
  "F02 · Agent loop dan tool inti"
  "F03 · Permissions dan mode"
  "F04 · Context management"
  "F05 · Sesi: persistensi, resume, export"
  "F06 · Hard budget dan combo fallback"
  "F07 · Verification gate"
  "F08 · MCP client"
  "F09 · Antarmuka: headless dan TUI"
  "F10 · Primitif subagent"
  "F11 · Orchestration v1"
  "F12 · Dashboard stats + RAM"
  "F13 · Frustrasi per model + saran"
  "F14 · Discord Rich Presence"
  "F15 · Appearance, status line, performa"
)
echo "Milestone:"
EXISTING="$(gh api "repos/$REPO/milestones?state=all&per_page=100" --jq '.[].title')"
for t in "${TITLES[@]}"; do
  prefix="${t%% *}"
  if grep -q "^$prefix " <<<"$EXISTING"; then
    echo "  ada    $t"
  else
    gh api "repos/$REPO/milestones" -f title="$t" >/dev/null
    echo "  dibuat $t"
  fi
done

# ---------- setelan merge ----------
echo "Setelan repo: squash saja, hapus branch setelah merge"
gh repo edit "$REPO" \
  --enable-squash-merge \
  --enable-merge-commit=false \
  --enable-rebase-merge=false \
  --delete-branch-on-merge >/dev/null

# ---------- proteksi main ----------
# Status check wajib = nama job di .github/workflows/ci.yml.
# Setelah Fase 0 menambah job perf, tambahkan namanya di CHECKS lalu jalankan ulang skrip ini.
CHECKS='["check (ubuntu-latest)", "check (windows-latest)"]'
echo "Proteksi main"
if gh api -X PUT "repos/$REPO/branches/main/protection" --input - >/dev/null 2>proteksi.err <<EOF
{
  "required_status_checks": { "strict": true, "contexts": $CHECKS },
  "enforce_admins": false,
  "required_pull_request_reviews": { "required_approving_review_count": 0 },
  "restrictions": null,
  "required_linear_history": true,
  "allow_force_pushes": false,
  "allow_deletions": false
}
EOF
then
  echo "  terpasang"
  rm -f proteksi.err
else
  echo "  GAGAL memasang proteksi:" >&2
  cat proteksi.err >&2; rm -f proteksi.err
  echo "  Penyebab umum: branch main belum ada (push commit pertama dulu), atau repo privat di akun gratis." >&2
fi

echo "Selesai."
