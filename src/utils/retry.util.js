'use strict';

const { delay } = require('./delay.util');
const { scraperConfig } = require('../config/scraper.config');

/**
 * Whether an error is a temporary failure worth retrying.
 * @param {Error} error
 * @returns {boolean}
 */
function isRetryableError(error) {
  if (!error) {
    return false;
  }
  if (error.retryable === true) {
    return true;
  }
  if (error.retryable === false) {
    return false;
  }

  const status = error.response?.status || error.statusCode;
  if (status && status >= 400 && status < 500 && status !== 429) {
    return false;
  }

  const code = error.code || '';
  const retryableCodes = new Set([
    'ECONNRESET',
    'ETIMEDOUT',
    'ECONNABORTED',
    'ENOTFOUND',
    'EAI_AGAIN',
    'ECONNREFUSED',
  ]);
  if (retryableCodes.has(code)) {
    return true;
  }

  if (status === 429 || (status && status >= 500)) {
    return true;
  }

  // Axios timeout
  if (error.message && /timeout/i.test(error.message)) {
    return true;
  }

  return !status;
}

/**
 * Execute async fn with exponential backoff.
 * @param {Function} fn
 * @param {object} [options]
 * @param {number} [options.retries]
 * @param {number} [options.baseMs]
 * @param {Function} [options.isRetryable]
 * @param {Function} [options.onRetry]
 * @returns {Promise<*>}
 */
async function withRetry(fn, options = {}) {
  const retries = options.retries ?? scraperConfig.retries;
  const baseMs = options.baseMs ?? scraperConfig.retryBaseMs;
  const check = options.isRetryable || isRetryableError;

  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn(attempt);
    } catch (error) {
      lastError = error;
      const canRetry = check(error) && attempt < retries;
      if (!canRetry) {
        break;
      }
      const waitMs = baseMs * 2 ** attempt;
      if (typeof options.onRetry === 'function') {
        options.onRetry({ attempt: attempt + 1, retries, waitMs, error });
      }
      await delay(waitMs);
    }
  }
  throw lastError;
}

module.exports = {
  isRetryableError,
  withRetry,
};
