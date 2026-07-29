'use strict';

const path = require('path');
const fsp = require('fs/promises');
const { getDetailCache, getStreamCache } = require('../infrastructure/cache');
const { getCatalogSsdCache } = require('../infrastructure/cache/CatalogSsdCache');
const { getRelatedSsdCache } = require('../infrastructure/cache/RelatedSsdCache');
const { getHtmlPageCache } = require('../infrastructure/cache/HtmlPageCache');
const { performanceConfig } = require('../config/performance.config');
const { ensureDir, listFilesRecursive } = require('../utils/file.util');
const { createLogger } = require('../infrastructure/logging/logger');
const { getMetrics } = require('../infrastructure/metrics/MetricsCollector');
const { getMemoryStats, maybeGc } = require('../utils/memory.util');

const logger = createLogger('cleanup');

/**
 * Automatic cleanup: expired caches, temp files, old logs.
 */
async function runCleanupJob(options = {}) {
  const started = Date.now();
  const report = {
    detail: null,
    stream: null,
    html: null,
    tempRemoved: 0,
    logsRemoved: 0,
    durationMs: 0,
    memory: getMemoryStats(),
  };

  try {
    report.detail = await getDetailCache().cleanup();
  } catch (error) {
    logger.warn('Detail cache cleanup failed', { message: error.message });
  }

  try {
    report.stream = await getStreamCache().cleanup();
  } catch (error) {
    logger.warn('Stream cache cleanup failed', { message: error.message });
  }

  try {
    report.catalog = await getCatalogSsdCache().cleanup();
  } catch (error) {
    logger.warn('Catalog SSD cache cleanup failed', { message: error.message });
  }

  try {
    report.related = await getRelatedSsdCache().cleanup();
  } catch (error) {
    logger.warn('Related SSD cache cleanup failed', { message: error.message });
  }

  try {
    report.html = getHtmlPageCache().cleanup();
  } catch (error) {
    logger.warn('HTML cache cleanup failed', { message: error.message });
  }

  try {
    report.tempRemoved = await cleanupDirOlderThan(
      options.tempDir || performanceConfig.tempDir,
      options.tempMaxAgeMs || 24 * 60 * 60 * 1000,
    );
  } catch (error) {
    logger.warn('Temp cleanup failed', { message: error.message });
  }

  try {
    const maxAgeMs =
      (options.logRetentionDays || performanceConfig.logRetentionDays) * 24 * 60 * 60 * 1000;
    report.logsRemoved = await cleanupDirOlderThan(
      options.logsDir || performanceConfig.logsDir,
      maxAgeMs,
    );
  } catch (error) {
    logger.warn('Log cleanup failed', { message: error.message });
  }

  maybeGc();
  report.durationMs = Date.now() - started;
  report.memoryAfter = getMemoryStats();
  getMetrics().timing('cleanup.job', report.durationMs);
  getMetrics().incr('cleanup.runs');

  logger.info('Cleanup job complete', report);
  return report;
}

/**
 * @param {string} dir
 * @param {number} maxAgeMs
 */
async function cleanupDirOlderThan(dir, maxAgeMs) {
  await ensureDir(dir);
  const files = await listFilesRecursive(dir);
  const now = Date.now();
  let removed = 0;
  for (const rel of files) {
    const full = path.join(dir, rel);
    try {
      const stat = await fsp.stat(full);
      if (now - stat.mtimeMs > maxAgeMs) {
        await fsp.unlink(full);
        removed += 1;
      }
    } catch {
      // ignore
    }
  }
  return removed;
}

module.exports = {
  runCleanupJob,
  cleanupDirOlderThan,
};
