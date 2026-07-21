'use strict';

const { assertSafeFetchUrl } = require('../utils/ssrf.util');
const { securityConfig } = require('../config/security.config');
const { createLogger } = require('../infrastructure/logging/logger');

const securityLogger = createLogger('security');

/**
 * Validate ?url= for Detail/Stream before controllers run.
 * Why: Reject bad input early; keep business services free of HTTP validation noise.
 */
function validateUrlQuery(req, res, next) {
  const raw = req.query.url;
  const result = assertSafeFetchUrl(raw, {
    maxLength: securityConfig.request.urlMaxLength,
  });

  if (!result.ok) {
    securityLogger.warn('URL validation failed', {
      requestId: req.requestId,
      ip: req.ip,
      path: req.originalUrl,
      code: result.code,
      // never log full raw URL if it contains credentials — assertSafe already rejects those
      urlLength: typeof raw === 'string' ? raw.length : 0,
    });

    const isStream = req.baseUrl === '/stream' || req.baseUrl === '/api/stream';
    const status = 400;
    const payload = isStream
      ? {
          success: false,
          error: {
            code: result.code,
            message: result.message,
            requestId: req.requestId,
          },
        }
      : {
          error: {
            code: result.code,
            message: result.message,
            requestId: req.requestId,
          },
        };
    return res.status(status).json(payload);
  }

  // Normalize to trimmed absolute URL for downstream
  req.validatedUrl = result.url.href;
  return next();
}

module.exports = { validateUrlQuery };
