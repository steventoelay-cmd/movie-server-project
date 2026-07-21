#!/usr/bin/env bash
# Backup env, data, logs, PM2 dump — skip bulky temp / node_modules.
# Usage: bash deploy/scripts/backup.sh
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/movies-server}"
BACKUP_ROOT="${BACKUP_ROOT:-/var/backups/movies-server}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
DEST="${BACKUP_ROOT}/${STAMP}"

mkdir -p "$DEST"

echo "==> Backup to ${DEST}"

# Secrets / env (restrictive perms on archive)
if [[ -f "${APP_DIR}/.env" ]]; then
  install -m 600 "${APP_DIR}/.env" "${DEST}/.env"
fi

# Generated catalog + previous snapshot (not GitHub CDN itself)
if [[ -d "${APP_DIR}/output" ]]; then
  tar -C "$APP_DIR" -czf "${DEST}/output.tar.gz" output
fi
if [[ -d "${APP_DIR}/data/previous" ]]; then
  tar -C "$APP_DIR" -czf "${DEST}/data-previous.tar.gz" data/previous
fi

# Cache (optional — useful for warm restart; exclude if huge)
if [[ -d "${APP_DIR}/data/cache" ]]; then
  tar -C "$APP_DIR" -czf "${DEST}/data-cache.tar.gz" data/cache
fi

# Application + PM2 logs (recent)
if [[ -d "${APP_DIR}/logs" ]]; then
  tar -C "$APP_DIR" -czf "${DEST}/logs.tar.gz" logs
fi
if [[ -d "${HOME}/.pm2" ]]; then
  tar -C "$HOME" -czf "${DEST}/pm2.tar.gz" .pm2/dump.pm2 .pm2/logs 2>/dev/null || true
fi

# Ecosystem config (no secrets)
if [[ -f "${APP_DIR}/ecosystem.config.cjs" ]]; then
  cp "${APP_DIR}/ecosystem.config.cjs" "${DEST}/"
fi

# Manifest
{
  echo "stamp=${STAMP}"
  echo "host=$(hostname)"
  echo "git=$(git -C "$APP_DIR" rev-parse HEAD 2>/dev/null || echo unknown)"
  date -u
} > "${DEST}/MANIFEST.txt"

chmod -R go-rwx "$DEST"

# Retention: keep last 14 backups
ls -1dt "${BACKUP_ROOT}"/* 2>/dev/null | tail -n +15 | xargs -r rm -rf

echo "Backup complete: ${DEST}"
