'use strict';

/**
 * Base application error. Never crashes the process by itself.
 */
class AppError extends Error {
  /**
   * @param {string} message
   * @param {object} [options]
   * @param {string} [options.code]
   * @param {number} [options.statusCode]
   * @param {object} [options.meta]
   * @param {boolean} [options.retryable]
   * @param {Error} [options.cause]
   */
  constructor(message, options = {}) {
    super(message);
    this.name = 'AppError';
    this.code = options.code || 'APP_ERROR';
    this.statusCode = options.statusCode || 500;
    this.meta = options.meta || {};
    this.retryable = Boolean(options.retryable);
    if (options.cause) {
      this.cause = options.cause;
    }
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      meta: this.meta,
      retryable: this.retryable,
    };
  }
}

module.exports = { AppError };
