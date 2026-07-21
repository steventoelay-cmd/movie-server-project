'use strict';

const { createLogger } = require('../infrastructure/logging/logger');
const { redactSensitive } = require('../utils/sanitize.util');
const { env } = require('../config/env');

const logger = createLogger('api');

/**
 * Centralized error handler — never crashes; never leaks secrets/stacks to clients.
 */
function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || err.status || 500;
  const code = err.code || 'INTERNAL_ERROR';
  const expose = statusCode < 500 || err.expose === true;

  logger.error('API error', {
    requestId: req.requestId,
    path: req.path,
    method: req.method,
    statusCode,
    code,
    message: err.message,
    meta: redactSensitive(err.meta || {}),
    // Stack only in debug logs / non-production
    ...(env.nodeEnv !== 'production' && env.logLevel === 'debug' ? { stack: err.stack } : {}),
  });

  if (res.headersSent) {
    return next(err);
  }

  const isStream =
    req.path === '/stream' ||
    req.path.startsWith('/stream') ||
    req.baseUrl === '/stream' ||
    req.baseUrl === '/api/stream';

  const safeMessage = expose ? err.message : 'Internal server error';

  if (isStream) {
    return res.status(statusCode).json({
      success: false,
      error: {
        code,
        message: safeMessage,
        requestId: req.requestId,
      },
    });
  }

  res.status(statusCode).json({
    error: {
      code,
      message: safeMessage,
      requestId: req.requestId,
    },
  });
}

module.exports = { errorHandler };
