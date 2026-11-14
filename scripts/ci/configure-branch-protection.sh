#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# Script: scripts/ci/configure-branch-protection.sh
# Purpose: Configures GitHub branch protection rules on main branch
# Usage:
#   GH_TOKEN=<token> ./scripts/ci/configure-branch-protection.sh <owner>/<repo>
# ==============================================================================

REPO="${1:-Intallo/Admission-Fee-Management-Portal}"
BRANCH="main"

echo "==> Configuring branch protection for ${REPO}:${BRANCH}..."

if ! command -v gh &> /dev/null; then
  echo "Error: GitHub CLI (gh) is required to run this script." >&2
  exit 1
fi

gh api \
  --method PUT \
  -H "Accept: application/vnd.github+json" \
  "/repos/${REPO}/branches/${BRANCH}/protection" \
  --input - <<EOF
{
  "required_status_checks": {
    "strict": true,
    "contexts": [
      "Lint, Typecheck, Unit Test, PostgreSQL Integration & Production Build"
    ]
  },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": false,
    "required_approving_review_count": 1
  },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false
}
EOF

echo "==> Successfully applied branch protection rules to ${REPO}:${BRANCH}."
