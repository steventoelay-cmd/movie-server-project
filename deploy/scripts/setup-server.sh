#!/usr/bin/env bash
# Initial AWS VPS bootstrap (Ubuntu 22.04 / 24.04).
# Run as root once. Creates non-root user, Node 20, Nginx, PM2, dirs.
#
# Usage:
#   sudo DOMAIN=api.example.com bash deploy/scripts/setup-server.sh
set -euo pipefail

APP_USER="${APP_USER:-movies}"
APP_DIR="${APP_DIR:-/opt/movies-server}"
DOMAIN="${DOMAIN:-}"
NODE_MAJOR="${NODE_MAJOR:-20}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root (sudo)."
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get upgrade -y
apt-get install -y curl git ufw nginx certbot python3-certbot-nginx build-essential

# Node.js (NodeSource)
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
  apt-get install -y nodejs
fi

node -v
npm -v

# Service user (no password login; SSH keys only)
if ! id "$APP_USER" >/dev/null 2>&1; then
  adduser --disabled-password --gecos "Movies API" "$APP_USER"
fi

mkdir -p "$APP_DIR" /var/www/certbot /var/backups/movies-server
chown -R "${APP_USER}:${APP_USER}" "$APP_DIR" /var/backups/movies-server

# PM2 global for APP_USER
su - "$APP_USER" -c "npm install -g pm2"

# Firewall
bash "$(dirname "$0")/firewall-ufw.sh"

# Logrotate
if [[ -f "$(dirname "$0")/../logrotate/movies-server" ]]; then
  cp "$(dirname "$0")/../logrotate/movies-server" /etc/logrotate.d/movies-server
fi

echo
echo "Bootstrap done."
echo "Next:"
echo "  1) Clone repo as ${APP_USER} into ${APP_DIR}"
echo "  2) Copy .env.production.example → ${APP_DIR}/.env and fill secrets (chmod 600)"
echo "  3) npm ci --omit=dev && pm2 start ecosystem.config.cjs --env production && pm2 save && pm2 startup"
echo "  4) Configure Nginx (deploy/nginx/movies-api.conf) DOMAIN=${DOMAIN:-YOUR_DOMAIN}"
echo "  5) sudo certbot --nginx -d ${DOMAIN:-YOUR_DOMAIN}"
echo "See docs/DEPLOYMENT.md"
