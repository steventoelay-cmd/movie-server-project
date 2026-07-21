#!/usr/bin/env bash
# Rollback to a previous git SHA and reload PM2.
# Usage: bash deploy/scripts/rollback.sh <git-sha>
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/movies-server}"
APP_NAME="${APP_NAME:-movies-api}"
SHA="${1:-}"

if [[ -z "$SHA" ]]; then
  echo "Usage: bash deploy/scripts/rollback.sh <git-sha>"
  exit 1
fi

cd "$APP_DIR"
echo "==> Checkout ${SHA}"
git fetch --prune origin
git checkout --force "$SHA"

echo "==> Install production dependencies"
npm ci --omit=dev

echo "==> Reload PM2"
pm2 reload ecosystem.config.cjs --only "$APP_NAME" --env production --update-env
pm2 save

BASE_URL="${BASE_URL:-http://127.0.0.1:3000}" bash "$(dirname "$0")/health-check.sh"
echo "Rollback complete."
