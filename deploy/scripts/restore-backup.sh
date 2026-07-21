#!/usr/bin/env bash
# Restore from a backup directory created by backup.sh
# Usage: bash deploy/scripts/restore-backup.sh /var/backups/movies-server/20260101T000000Z
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/movies-server}"
SRC="${1:-}"

if [[ -z "$SRC" || ! -d "$SRC" ]]; then
  echo "Usage: bash deploy/scripts/restore-backup.sh <backup-dir>"
  exit 1
fi

echo "==> Restoring from ${SRC}"

if [[ -f "${SRC}/.env" ]]; then
  install -m 600 "${SRC}/.env" "${APP_DIR}/.env"
fi

restore_tar() {
  local archive="$1"
  if [[ -f "$archive" ]]; then
    tar -C "$APP_DIR" -xzf "$archive"
    echo "Restored $(basename "$archive")"
  fi
}

restore_tar "${SRC}/output.tar.gz"
restore_tar "${SRC}/data-previous.tar.gz"
restore_tar "${SRC}/data-cache.tar.gz"
restore_tar "${SRC}/logs.tar.gz"

if [[ -f "${SRC}/ecosystem.config.cjs" ]]; then
  cp "${SRC}/ecosystem.config.cjs" "${APP_DIR}/"
fi

echo "Restore complete. Run: pm2 reload ecosystem.config.cjs --env production"
