#!/usr/bin/env bash
# Package the repo for sharing/review, excluding every real .env file so
# credentials never leak in a zip/tarball. Only .env.example files ship.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
out="${1:-${root}/bsafe-for-review.zip}"

cd "$root"

tmp=$(mktemp)
trap 'rm -f "$tmp"' EXIT

# All files git knows about (tracked + untracked-but-not-ignored).
git ls-files -co --exclude-standard > "$tmp"

# Keep .env.example, drop every other dotenv file.
grep -v -E '(^|/)\.env(\.|$)' "$tmp" | grep -E '\.env\.example$' >> "$tmp" || true

rm -f "$out"
sort -u "$tmp" | zip -q "$out" -@

echo "Packaged -> $out (all real .env files excluded)"