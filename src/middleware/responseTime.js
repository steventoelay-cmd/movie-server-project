'use strict';

/**
 * Record API response times without changing response bodies.
 */
const { getMetrics } = require('../infrastructure/metrics/MetricsCollector');

function responseTime(req, res, next) {
  const started = Date.now();
  res.on('finish', () => {
    const durationMs = Date.now() - started;
    getMetrics().recordApiDuration(durationMs);
    getMetrics().incr(`api.${req.method}.${req.baseUrl || req.path}.count`);
  });
  next();
}

module.exports = { responseTime };
