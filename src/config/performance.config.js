'use strict';

const path = require('path');
const { env, intEnv, boolEnv } = require('./env');
const { rootDir } = require('./pipeline.config');

// Extend env usage — performance knobs (safe defaults)
const performanceConfig = Object.freeze({
  htmlCacheEnabled: boolEnv('HTML_CACHE_ENABLED', true),
  htmlCacheTtlMs: intEnv('HTML_CACHE_TTL_MS', 60 * 1000),
  htmlCacheMaxEntries: intEnv('HTML_CACHE_MAX_ENTRIES', 500),
  sectionConcurrency: intEnv('PIPELINE_SECTION_CONCURRENCY', 1),
  /** 1 = one parent at a time (1GB VPS friendly) */
  parentConcurrency: intEnv('PIPELINE_PARENT_CONCURRENCY', 1),
  sequentialSections: boolEnv('PIPELINE_SEQUENTIAL_SECTIONS', true),
  /** Hint GC after each scraped page when available */
  clearMemoryAfterPage: boolEnv('PIPELINE_CLEAR_MEMORY_AFTER_PAGE', true),
  cleanupCron: process.env.CLEANUP_CRON || '0 * * * *',
  cleanupEnabled: boolEnv('CLEANUP_ENABLED', true),
  metricsIntervalMs: intEnv('METRICS_INTERVAL_MS', 60 * 1000),
  metricsEnabled: boolEnv('METRICS_ENABLED', true),
  logMemory: boolEnv('LOG_MEMORY_STATS', true),
  logRetentionDays: intEnv('LOG_RETENTION_DAYS', 7),
  logsDir: path.resolve(rootDir, process.env.LOGS_DIR || 'logs'),
  tempDir: path.resolve(rootDir, process.env.TEMP_DIR || 'data/tmp'),
  skipUnchangedJsonWrites: boolEnv('SKIP_UNCHANGED_JSON_WRITES', true),
  gracefulShutdownMs: intEnv('SHUTDOWN_TIMEOUT_MS', 10000),
});

module.exports = { performanceConfig };
