'use strict';

const { AppError } = require('./AppError');

class GitHubError extends AppError {
  /**
   * @param {string} message
   * @param {object} [options]
   */
  constructor(message, options = {}) {
    super(message, {
      code: options.code || 'GITHUB_ERROR',
      statusCode: options.statusCode || 502,
      meta: options.meta || {},
      retryable: options.retryable ?? false,
      cause: options.cause,
    });
    this.name = 'GitHubError';
  }
}

module.exports = { GitHubError };
