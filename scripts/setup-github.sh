#!/usr/bin/env bash
# Crea il repo GitHub e protegge main. Uso: scripts/setup-github.sh <owner>/<repo>
set -euo pipefail
REPO="${1:?uso: $0 <owner>/<repo>}"

gh repo create "$REPO" --private --source=. --remote=origin --push

gh api -X PUT "repos/$REPO/branches/main/protection" --input - <<JSON
{
  "required_status_checks": { "strict": true, "contexts": ["backend", "frontend"] },
  "enforce_admins": false,
  "required_pull_request_reviews": { "required_approving_review_count": 0 },
  "restrictions": null,
  "required_linear_history": true,
  "allow_force_pushes": false,
  "allow_deletions": false
}
JSON

gh repo edit "$REPO" --enable-squash-merge --enable-merge-commit=false --enable-rebase-merge=false --delete-branch-on-merge
echo "Ricorda: aggiungi il secret ANTHROPIC_API_KEY e collega il repo a Vercel."
