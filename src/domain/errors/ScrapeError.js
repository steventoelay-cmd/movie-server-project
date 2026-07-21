'use strict';

const { AppError } = require('./AppError');

/**
 * Scraping-layer error (fetch/parse/validate).
 */
class ScrapeError extends AppError {
  /**
   * @param {string} message
   * @param {object} [options]
   */
  constructor(message, options = {}) {
    super(message, {
      code: options.code || 'SCRAPE_ERROR',
      statusCode: options.statusCode || 502,
      meta: options.meta || {},
      retryable: options.retryable ?? false,
      cause: options.cause,
    });
    this.name = 'ScrapeError';
  }
}

module.exports = { ScrapeError };
