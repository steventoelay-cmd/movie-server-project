#!/usr/bin/env bash
# Zero-downtime-ish update on the VPS (reload preferred over hard restart).
#
# Usage (on server, as deploy user):
#   bash deploy/scripts/deploy.sh
#   bash deploy/scripts/deploy.sh --branch main
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/movies-server}"
BRANCH="${BRANCH:-main}"
APP_NAME="${APP_NAME:-movies-api}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --branch) BRANCH="$2"; shift 2 ;;
    --dir) APP_DIR="$2"; shift 2 ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

cd "$APP_DIR"

echo "==> Fetch ${BRANCH}"
git fetch --prune origin
PREV_SHA="$(git rev-parse HEAD)"
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"
NEW_SHA="$(git rev-parse HEAD)"
echo "Updated ${PREV_SHA:0:8} → ${NEW_SHA:0:8}"

echo "==> Install production dependencies"
npm ci --omit=dev

echo "==> Reload PM2 (graceful SIGTERM → wait_ready)"
if pm2 describe "$APP_NAME" >/dev/null 2>&1; then
  pm2 reload ecosystem.config.cjs --only "$APP_NAME" --env production --update-env
else
  pm2 start ecosystem.config.cjs --only "$APP_NAME" --env production
fi
pm2 save

echo "==> Health check"
BASE_URL="${BASE_URL:-http://127.0.0.1:3000}" bash "$(dirname "$0")/health-check.sh"

echo "Deploy complete."
