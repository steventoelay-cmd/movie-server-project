'use strict';

const { securityConfig } = require('../config/security.config');
const { createLogger } = require('../infrastructure/logging/logger');

const securityLogger = createLogger('security');

/**
 * Build CORS options from env.
 * Why: Wildcard CORS in production exposes APIs to any browser origin.
 */
function buildCorsOptions() {
  const cfg = securityConfig.cors;
  const origins = cfg.origins;

  return {
    methods: cfg.methods,
    allowedHeaders: cfg.allowedHeaders,
    maxAge: cfg.maxAgeSec,
    optionsSuccessStatus: 204,
    origin(origin, callback) {
      // Non-browser / same-origin / curl — no Origin header
      if (!origin) {
        return callback(null, true);
      }

      if (origins.includes('*')) {
        if (securityConfig.isProduction && !cfg.allowWildcardInProduction) {
          securityLogger.warn('CORS rejected wildcard in production', { origin });
          return callback(new Error('CORS origin not allowed'));
        }
        return callback(null, true);
      }

      if (origins.includes(origin)) {
        return callback(null, true);
      }

      securityLogger.warn('CORS origin rejected', { origin });
      return callback(new Error('CORS origin not allowed'));
    },
  };
}

module.exports = { buildCorsOptions };
