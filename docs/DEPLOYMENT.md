# AWS Production Deployment & Operations

Deploy and operate the Movies Server Node.js backend on an **AWS VPS** (Ubuntu 22.04/24.04) with **PM2**, **Nginx**, and **Let's Encrypt**.

Application behavior and API contracts are unchanged. Secrets never live in Git.

## Architecture

```
Internet
   │
   ▼
Nginx :443 (TLS) / :80 → redirect
   │
   ▼
Node.js (PM2) 127.0.0.1:3000
   │
   ├── GET /health
   ├── GET /detail
   ├── GET /stream
   └── POST /admin/pipeline
```

| Layer | Role |
|-------|------|
| **UFW** | SSH / 80 / 443 only |
| **Nginx** | TLS, reverse proxy, gzip, headers |
| **PM2** | Auto-restart, boot start, logs, memory cap |
| **`.env`** | Secrets on disk (`chmod 600`), not in Git |

## Prerequisites

- AWS EC2 (or Lightsail) Ubuntu instance
- Elastic IP / DNS A record → instance
- SSH key authentication (disable password login)
- Domain name for HTTPS (e.g. `api.example.com`)

## 1. Initial server setup

### 1.1 Bootstrap packages + firewall

As `ubuntu` / root:

```bash
sudo DOMAIN=api.example.com bash deploy/scripts/setup-server.sh
```

This installs Node.js 20, Nginx, Certbot, UFW, creates user `movies`, opens ports **22/80/443**.

### 1.2 Clone application (non-root)

```bash
sudo mkdir -p /opt/movies-server
sudo chown movies:movies /opt/movies-server
sudo -u movies -i
cd /opt/movies-server
git clone <YOUR_REPO_URL> .
```

### 1.3 Environment

```bash
cp .env.production.example .env
nano .env   # fill API_KEY, ADMIN_API_KEY, GITHUB_*, CORS_ORIGIN, DOMAIN hosts
chmod 600 .env
```

**Never** commit `.env`. Confirm `.gitignore` includes `.env`.

### 1.4 Install + start PM2

```bash
npm ci --omit=dev
pm2 start ecosystem.config.cjs --only movies-api --env production
pm2 save
pm2 startup   # run the command it prints (as root)
```

Verify:

```bash
bash deploy/scripts/health-check.sh
pm2 status
```

### 1.5 Nginx + SSL

```bash
# As root
sudo cp /opt/movies-server/deploy/nginx/movies-api.conf /etc/nginx/sites-available/movies-api
sudo sed -i 's/YOUR_DOMAIN/api.example.com/g' /etc/nginx/sites-available/movies-api
sudo ln -sf /etc/nginx/sites-available/movies-api /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo mkdir -p /var/www/certbot
sudo nginx -t && sudo systemctl reload nginx

sudo certbot --nginx -d api.example.com
# Auto-renewal is installed by certbot (timer/cron)
sudo systemctl status certbot.timer   # or: sudo certbot renew --dry-run
```

Public health:

```bash
BASE_URL=https://api.example.com bash deploy/scripts/health-check.sh
```

## 2. PM2 configuration

File: [`ecosystem.config.cjs`](../ecosystem.config.cjs)

| App name | Env | Notes |
|----------|-----|--------|
| `movies-api` | `--env production` | `HOST=127.0.0.1`, scheduler on, memory restart 512M |
| `movies-api-dev` | development | Bind `0.0.0.0`, scheduler off |

Features:

- Autorestart on crash
- `pm2 startup` → restart on reboot
- `max_memory_restart: 512M`
- Logs under `logs/pm2-*.log`
- `wait_ready` + `kill_timeout: 12s` (aligned with `SHUTDOWN_TIMEOUT_MS`)

Useful commands:

```bash
pm2 status
pm2 logs movies-api
pm2 reload movies-api --update-env
pm2 restart movies-api
pm2 monit
```

## 3. Graceful shutdown

Implemented in `src/server.js` (SIGINT / SIGTERM):

1. Stop scheduler + outbound request queue  
2. `server.close()` — stop new connections; finish in-flight requests  
3. Cleanup expired cache entries (disk already persisted on write)  
4. Exit `0`, or force exit after `SHUTDOWN_TIMEOUT_MS` (default 10s)

PM2 sends SIGINT/SIGTERM on reload/stop; `kill_timeout` must exceed shutdown timeout.

## 4. Update (deploy) workflow

```text
Developer git push
        ↓
ssh → server
        ↓
deploy/scripts/deploy.sh
        ↓
git pull → npm ci --omit=dev → pm2 reload → /health
```

On the server:

```bash
cd /opt/movies-server
bash deploy/scripts/deploy.sh --branch main
```

Avoids hard kill when possible (`pm2 reload` + graceful shutdown). Single-instance fork mode still has a **short** window without listeners; keep health checks and retries on the Flutter client.

## 5. Rollback

```bash
git log --oneline -10
bash deploy/scripts/rollback.sh <previous-sha>
```

## 6. Backup & restore

### Backup (cron recommended)

```bash
# Daily 03:15 UTC as movies user
crontab -e
15 3 * * * APP_DIR=/opt/movies-server /opt/movies-server/deploy/scripts/backup.sh >> /opt/movies-server/logs/backup.log 2>&1
```

Includes:

- `.env`
- `output/` catalog JSON
- `data/previous/`
- `data/cache/` (optional warm start)
- `logs/`, PM2 dump
- `ecosystem.config.cjs`

Excludes: `node_modules`, temp scrape HTML.

Retention: last **14** backup directories under `/var/backups/movies-server/`.

### Restore

```bash
bash deploy/scripts/restore-backup.sh /var/backups/movies-server/<STAMP>
pm2 reload ecosystem.config.cjs --only movies-api --env production
bash deploy/scripts/health-check.sh
```

## 7. Log management

| Source | Location | Rotation |
|--------|----------|----------|
| App / PM2 | `/opt/movies-server/logs/` | `deploy/logrotate/movies-server` |
| PM2 default | `~/.pm2/logs/` | same logrotate file |
| Nginx | `/var/log/nginx/movies-api.*.log` | distro nginx logrotate |

Install:

```bash
sudo cp deploy/logrotate/movies-server /etc/logrotate.d/movies-server
sudo logrotate -d /etc/logrotate.d/movies-server
```

## 8. Health verification checklist

After every deploy:

- [ ] `pm2 status` → `online`
- [ ] `curl -s http://127.0.0.1:3000/health` → `"status":"ok"`
- [ ] `curl -s https://YOUR_DOMAIN/health` → ok
- [ ] Memory under restart threshold (`pm2 monit`)
- [ ] No spike in Nginx `error.log`
- [ ] Optional: Detail/Stream sample with `X-Api-Key`

Script: `deploy/scripts/health-check.sh`

## 9. Security checklist

- [ ] SSH key-only; `PasswordAuthentication no`
- [ ] App runs as `movies`, not root
- [ ] `.env` mode `600`, owned by `movies`
- [ ] `HOST=127.0.0.1` — port 3000 not in UFW
- [ ] `REQUIRE_API_KEY=true`, strong `API_KEY` / `ADMIN_API_KEY`
- [ ] `CORS_ORIGIN` set to real app origins (no `*`)
- [ ] TLS via Let's Encrypt; HSTS via Nginx
- [ ] `apt update && apt upgrade` regularly
- [ ] See also [`SECURITY.md`](../SECURITY.md)

## 10. Troubleshooting

| Symptom | Check |
|---------|--------|
| PM2 `errored` | `pm2 logs movies-api` — often missing `API_KEY` in production |
| 502 from Nginx | App down / wrong upstream; `ss -lntp \| grep 3000` |
| SSL fail | DNS A record; `sudo certbot renew --dry-run` |
| High memory | Lower concurrency env; raise `max_memory_restart` carefully |
| Disk full | `logrotate`, clear old `data/cache`, `du -sh /opt/movies-server/*` |
| Deploy health fail | `BASE_URL=http://127.0.0.1:3000 bash deploy/scripts/health-check.sh` |

## 11. File map

```
ecosystem.config.cjs
.env.production.example
deploy/
  nginx/movies-api.conf
  logrotate/movies-server
  scripts/
    setup-server.sh
    deploy.sh
    rollback.sh
    backup.sh
    restore-backup.sh
    health-check.sh
    firewall-ufw.sh
docs/DEPLOYMENT.md
```

## 12. Scalability (future growth)

See [`docs/SCALABILITY.md`](SCALABILITY.md) for Redis/DB/queue/multi-server triggers.
Single VPS + GitHub JSON remains the default until those triggers are met.


```bash
npm start                 # node src/server.js
npm run pm2:start         # production ecosystem
npm run pm2:reload
npm run pm2:stop
npm run pm2:logs
```
