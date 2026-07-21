'use strict';

const { createApp } = require('./app');
const { apiConfig } = require('./config/api.config');
const { performanceConfig } = require('./config/performance.config');
const { securityConfig } = require('./config/security.config');
const { validateEnv } = require('./config/validateEnv');
const { createLogger } = require('./infrastructure/logging/logger');
const { registerSites } = require('./scrapers/registerSites');
const { PipelineScheduler } = require('./jobs/scheduler');
const { runCleanupJob } = require('./jobs/cleanup.job');
const { defaultQueue } = require('./infrastructure/http/HtmlFetcher');
const { getDetailCache, getStreamCache, getHtmlPageCache } = require('./infrastructure/cache');
const { getMemoryStats } = require('./utils/memory.util');

const logger = createLogger('server');

/**
 * Persist / prune cache L2 before exit. File-backed entries are already written on set;
 * cleanup removes expired rows so the next boot starts clean.
 */
async function finalizeCaches() {
  const tasks = [];
  try {
    const detail = getDetailCache();
    if (detail && typeof detail.cleanup === 'function') {
      tasks.push(Promise.resolve(detail.cleanup()));
    }
  } catch (_) {
    /* ignore */
  }
  try {
    const stream = getStreamCache();
    if (stream && typeof stream.cleanup === 'function') {
      tasks.push(Promise.resolve(stream.cleanup()));
    }
  } catch (_) {
    /* ignore */
  }
  try {
    const html = getHtmlPageCache();
    if (html && typeof html.cleanup === 'function') {
      tasks.push(Promise.resolve(html.cleanup()));
    }
  } catch (_) {
    /* ignore */
  }
  await Promise.allSettled(tasks);
}

function startServer(options = {}) {
  // Fail fast on insecure/misconfigured production env — never print secrets
  validateEnv({ strict: options.strictEnv });

  registerSites();
  const app = createApp();
  const port = options.port || apiConfig.port;
  const host = options.host || apiConfig.host;

  const server = app.listen(port, host, () => {
    logger.info('HTTP server listening', {
      host,
      port,
      detail: 'GET /detail?url=',
      stream: 'GET /stream?url=',
      health: 'GET /health',
      admin: 'POST /admin/pipeline',
      memory: getMemoryStats(),
    });
    // PM2 wait_ready / readiness signal (no-op if not under PM2)
    if (typeof process.send === 'function') {
      process.send('ready');
    }
  });

  // Align with Nginx proxy_read_timeout so keep-alive is not cut mid-flight
  server.requestTimeout = options.requestTimeout || securityConfig.request.timeoutMs;
  server.keepAliveTimeout = options.keepAliveTimeout || 65_000;
  server.headersTimeout =
    options.headersTimeout || Math.max((server.requestTimeout || 30000) + 5000, 66_000);

  let scheduler = null;
  if (options.startScheduler === true || process.env.START_SCHEDULER_WITH_SERVER === 'true') {
    scheduler = new PipelineScheduler();
    scheduler.start();
    setTimeout(() => {
      runCleanupJob().catch(() => {});
    }, 15_000).unref?.();
  }

  let shuttingDown = false;

  const shutdown = (signal) => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;

    logger.info('Graceful shutdown starting', { signal, memory: getMemoryStats() });

    // 1) Stop cron / outbound queue — no new background work
    if (scheduler) {
      scheduler.stop();
    }
    if (defaultQueue && typeof defaultQueue.close === 'function') {
      defaultQueue.close();
    }

    const timer = setTimeout(() => {
      logger.warn('Forced exit after shutdown timeout');
      process.exit(1);
    }, performanceConfig.gracefulShutdownMs);
    timer.unref?.();

    // 2) Stop accepting new HTTP connections; finish in-flight requests
    server.close(async () => {
      try {
        // 3) Prune expired cache entries (disk state already persisted on writes)
        await finalizeCaches();
      } catch (error) {
        logger.warn('Cache finalize during shutdown failed', { message: error.message });
      }
      clearTimeout(timer);
      logger.info('HTTP server closed');
      process.exit(0);
    });
  };

  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));

  return { app, server, scheduler, shutdown };
}

module.exports = { startServer, createApp };

if (require.main === module) {
  try {
    startServer();
  } catch (error) {
    logger.error('Server failed to start', { message: error.message, code: error.code });
    process.exit(1);
  }
}
