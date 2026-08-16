#!/usr/bin/env bash
# Reject any real .env file from being committed. Runs against staged files
# (or the whole tree with --all) so a future git-secrets/gitleaks hook can
# reuse the same logic.
set -euo pipefail

if [[ "${1:-}" == "--all" ]]; then
  # Any file that is a dotenv file (not an .env.example) present in the repo.
  bad=$(git ls-files -co --exclude-standard | grep -E '(^|/)\.env($|\.)' | grep -v '\.env\.example$' || true)
else
  bad=$(git diff --cached --name-only --diff-filter=ACMR | grep -E '(^|/)\.env($|\.)' | grep -v '\.env\.example$' || true)
fi

if [[ -n "$bad" ]]; then
  echo "ERROR: real .env file(s) staged/present — refusing:" >&2
  echo "$bad" >&2
  exit 1
fi

echo "OK: no real .env files"