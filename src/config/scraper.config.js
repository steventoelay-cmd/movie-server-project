'use strict';

const { env } = require('./env');

/**
 * Scraper-engine configuration (timeouts, retry, rate limits, UA).
 */
const scraperConfig = Object.freeze({
  timeoutMs: env.requestTimeoutMs,
  retries: env.requestRetries,
  retryBaseMs: env.requestRetryBaseMs,
  requestIntervalMs: env.requestIntervalMs,
  maxConcurrency: env.requestMaxConcurrency,
  userAgent: env.userAgent,
  userAgentPool: env.userAgentPool,
  defaultHeaders: Object.freeze({
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Cache-Control': 'no-cache',
  }),
});

module.exports = { scraperConfig };
