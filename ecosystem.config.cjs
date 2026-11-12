'use strict';

/**
 * PM2 ecosystem — AWS VPS production / development.
 *
 * Usage:
 *   pm2 start ecosystem.config.cjs --env production
 *   pm2 start ecosystem.config.cjs --only movies-api-dev
 *   pm2 save && pm2 startup
 *
 * Secrets stay in .env (never commit). PM2 loads dotenv via env_file is not
 * built-in — the app already calls dotenv in src/config/env.js.
 */

const fs = require('fs');
const path = require('path');

const root = __dirname;
const logsDir = path.join(root, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const shared = {
  script: 'src/server.js',
  cwd: root,
  interpreter: 'node',
  instances: 1,
  exec_mode: 'fork',
  autorestart: true,
  watch: false,
  max_memory_restart: '512M',
  kill_timeout: 12000,
  listen_timeout: 10000,
  wait_ready: true,
  merge_logs: true,
  time: true,
  error_file: path.join(logsDir, 'pm2-error.log'),
  out_file: path.join(logsDir, 'pm2-out.log'),
  log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
};

module.exports = {
  apps: [
    {
      ...shared,
      name: 'movies-api',
      env: {
        NODE_ENV: 'development',
        HOST: '0.0.0.0',
        PORT: 3000,
        START_SCHEDULER_WITH_SERVER: 'false',
      },
      env_production: {
        NODE_ENV: 'production',
        // Bind localhost only — Nginx terminates TLS and proxies here
        HOST: '127.0.0.1',
        PORT: 3000,
        START_SCHEDULER_WITH_SERVER: 'false',
        HEALTH_EXPOSE_METRICS: 'false',
        REQUIRE_API_KEY: 'true',
        LOG_LEVEL: 'info',
      },
    },
    {
      ...shared,
      name: 'movies-api-dev',
      env: {
        NODE_ENV: 'development',
        HOST: '0.0.0.0',
        PORT: 3000,
        START_SCHEDULER_WITH_SERVER: 'false',
        LOG_LEVEL: 'debug',
      },
    },
  ],
};
