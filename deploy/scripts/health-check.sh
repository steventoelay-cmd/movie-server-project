#!/usr/bin/env bash
# Post-deploy health verification.
# Usage:
#   bash deploy/scripts/health-check.sh
#   BASE_URL=https://api.example.com bash deploy/scripts/health-check.sh
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:3000}"
RETRIES="${RETRIES:-10}"
SLEEP_SEC="${SLEEP_SEC:-2}"

echo "==> Health check against ${BASE_URL}/health"

for i in $(seq 1 "$RETRIES"); do
  if curl -fsS --max-time 10 "${BASE_URL}/health" | grep -q '"status":"ok"'; then
    echo "OK: /health returned status ok (attempt ${i})"
    curl -fsS --max-time 10 "${BASE_URL}/health" || true
    echo
    if command -v pm2 >/dev/null 2>&1; then
      echo "==> PM2 status"
      pm2 status || true
      echo "==> Memory / CPU (pm2 monit snapshot)"
      pm2 jlist 2>/dev/null | head -c 2000 || true
      echo
    fi
    exit 0
  fi
  echo "Waiting for health... (${i}/${RETRIES})"
  sleep "$SLEEP_SEC"
done

echo "FAIL: /health did not become healthy"
exit 1
