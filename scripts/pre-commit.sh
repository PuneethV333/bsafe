#!/usr/bin/env bash
# Pre-commit hook: reject staging a real .env file.
set -euo pipefail
"$(git rev-parse --show-toplevel)/scripts/check-env-secrets.sh"