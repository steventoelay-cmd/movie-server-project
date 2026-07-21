'use strict';

const { scraperConfig } = require('../../config/scraper.config');

let roundRobinIndex = 0;

/**
 * Resolve User-Agent (supports future pool rotation).
 * @param {object} [options]
 * @param {string} [options.userAgent]
 * @returns {string}
 */
function resolveUserAgent(options = {}) {
  if (options.userAgent) {
    return options.userAgent;
  }
  const pool = scraperConfig.userAgentPool;
  if (pool.length > 0) {
    const ua = pool[roundRobinIndex % pool.length];
    roundRobinIndex += 1;
    return ua;
  }
  return scraperConfig.userAgent;
}

/**
 * @param {object} [overrides]
 * @returns {object}
 */
function buildHeaders(overrides = {}) {
  return {
    'User-Agent': resolveUserAgent(overrides),
    ...scraperConfig.defaultHeaders,
    ...overrides.headers,
  };
}

module.exports = {
  resolveUserAgent,
  buildHeaders,
};
