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
# Required job names from ci.yml and baseline.yml, bound to GitHub Actions.
CHECKS='[
  {"context":"check (ubuntu-latest)","integration_id":15368},
  {"context":"check (windows-latest)","integration_id":15368},
  {"context":"measure (ubuntu-latest)","integration_id":15368},
  {"context":"measure (windows-latest)","integration_id":15368},
  {"context":"measure (macos-latest)","integration_id":15368},
  {"context":"perf (ubuntu-latest)","integration_id":15368},
  {"context":"perf (windows-latest)","integration_id":15368}
]'
echo "Proteksi main"
RULESET_ID="$(gh api "repos/$REPO/rulesets?includes_parents=false&per_page=100" --paginate \
  --jq '.[] | select(.name == "Protect main" and .target == "branch" and .source_type == "Repository") | .id')"
if [[ -n "$RULESET_ID" && ! "$RULESET_ID" =~ ^[0-9]+$ ]]; then
  echo "Ambiguous Protect main rulesets; review the repository rulesets before retrying." >&2
  exit 1
fi
METHOD=POST
ENDPOINT="repos/$REPO/rulesets"
if [[ -n "$RULESET_ID" ]]; then
  METHOD=PUT
  ENDPOINT="$ENDPOINT/$RULESET_ID"
fi
gh api -X "$METHOD" "$ENDPOINT" --input - >/dev/null <<EOF
{
  "name": "Protect main",
  "target": "branch",
  "enforcement": "active",
  "bypass_actors": [],
  "conditions": { "ref_name": { "include": ["refs/heads/main"], "exclude": [] } },
  "rules": [
    { "type": "deletion" },
    { "type": "non_fast_forward" },
    { "type": "required_linear_history" },
    { "type": "pull_request", "parameters": {
      "required_approving_review_count": 0,
      "dismiss_stale_reviews_on_push": true,
      "required_reviewers": [],
      "require_code_owner_review": false,
      "require_last_push_approval": false,
      "required_review_thread_resolution": true,
      "require_extra_approval_for_unattributed_changes": false,
      "allowed_merge_methods": ["squash"]
    } },
    { "type": "required_status_checks", "parameters": {
      "strict_required_status_checks_policy": true,
      "do_not_enforce_on_create": false,
      "required_status_checks": $CHECKS
    } }
  ]
}
EOF
echo "  ruleset terpasang"

echo "Selesai."
