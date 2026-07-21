'use strict';

/**
 * Lightweight inbound rate limiter (per IP). Redis-replaceable later.
 */
function createRateLimiter({ windowMs, max, message }) {
  /** @type {Map<string, { count: number, resetAt: number }>} */
  const buckets = new Map();

  return function rateLimiter(req, res, next) {
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    const now = Date.now();
    let bucket = buckets.get(ip);

    if (!bucket || now > bucket.resetAt) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(ip, bucket);
    }

    bucket.count += 1;
    if (bucket.count > max) {
      res.setHeader('Retry-After', Math.ceil((bucket.resetAt - now) / 1000));
      return res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMITED',
          message: message || 'Too many stream requests',
        },
      });
    }

    return next();
  };
}

module.exports = { createRateLimiter };
