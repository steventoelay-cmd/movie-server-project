'use strict';

const { createRateLimiter } = require('./rateLimiter');
const { securityConfig } = require('../config/security.config');
const { createLogger } = require('../infrastructure/logging/logger');

const securityLogger = createLogger('security');

/**
 * Per-route rate limiters.
 * Why: Stream is expensive (scrape+extract); Detail less so; Health is cheap but still floodable.
 */
const detailRateLimit = createRateLimiter({
  windowMs: securityConfig.rateLimit.detailWindowMs,
  max: securityConfig.rateLimit.detailMax,
  message: 'Too many detail requests',
});

const streamRateLimit = createRateLimiter({
  windowMs: securityConfig.rateLimit.streamWindowMs,
  max: securityConfig.rateLimit.streamMax,
  message: 'Too many stream requests',
});

const healthRateLimit = createRateLimiter({
  windowMs: securityConfig.rateLimit.healthWindowMs,
  max: securityConfig.rateLimit.healthMax,
  message: 'Too many health requests',
});

const adminRateLimit = createRateLimiter({
  windowMs: securityConfig.rateLimit.adminWindowMs,
  max: securityConfig.rateLimit.adminMax,
  message: 'Too many admin requests',
});

/** Wrap to log rate-limit blocks */
function withSecurityLog(limiter, routeName) {
  return function loggedLimiter(req, res, next) {
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      if (res.statusCode === 429) {
        securityLogger.warn('Rate limit exceeded', {
          route: routeName,
          ip: req.ip,
          requestId: req.requestId,
          path: req.originalUrl,
        });
      }
      return originalJson(body);
    };
    return limiter(req, res, next);
  };
}

module.exports = {
  detailRateLimit: withSecurityLog(detailRateLimit, 'detail'),
  streamRateLimit: withSecurityLog(streamRateLimit, 'stream'),
  healthRateLimit: withSecurityLog(healthRateLimit, 'health'),
  adminRateLimit: withSecurityLog(adminRateLimit, 'admin'),
};
