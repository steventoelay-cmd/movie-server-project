#!/usr/bin/env bash
# UFW firewall — allow SSH/HTTP/HTTPS only.
# Usage: sudo bash deploy/scripts/firewall-ufw.sh
set -euo pipefail

if ! command -v ufw >/dev/null 2>&1; then
  apt-get update -y
  apt-get install -y ufw
fi

ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
# Node listens on 127.0.0.1 only in production — do NOT open 3000 publicly

ufw --force enable
ufw status verbose
echo "Firewall configured."
