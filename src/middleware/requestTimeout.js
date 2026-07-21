'use strict';

const { securityConfig } = require('../config/security.config');
const { createLogger } = require('../infrastructure/logging/logger');

const securityLogger = createLogger('security');

/**
 * Per-request timeout — abort hanging handlers.
 * Why: Slow/hung scrapes can exhaust VPS connections under flood.
 */
function requestTimeout(req, res, next) {
  const ms = securityConfig.request.timeoutMs;
  if (!ms || ms < 1) {
    return next();
  }

  res.setTimeout(ms, () => {
    if (res.headersSent) {
      return;
    }
    securityLogger.warn('Request timeout', {
      requestId: req.requestId,
      path: req.originalUrl,
      timeoutMs: ms,
      ip: req.ip,
    });
    const isStream = req.baseUrl === '/stream' || req.baseUrl === '/api/stream';
    res.status(408).json(
      isStream
        ? {
            success: false,
            error: {
              code: 'REQUEST_TIMEOUT',
              message: 'Request timed out',
              requestId: req.requestId,
            },
          }
        : {
            error: {
              code: 'REQUEST_TIMEOUT',
              message: 'Request timed out',
              requestId: req.requestId,
            },
          },
    );
  });

  next();
}

module.exports = { requestTimeout };
