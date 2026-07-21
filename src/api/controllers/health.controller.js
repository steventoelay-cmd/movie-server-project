'use strict';

const { getDetailCache, getStreamCache } = require('../../infrastructure/cache');
const { getHtmlPageCache } = require('../../infrastructure/cache/HtmlPageCache');
const { getMetrics } = require('../../infrastructure/metrics/MetricsCollector');
const { defaultQueue } = require('../../infrastructure/http/HtmlFetcher');
const { securityConfig } = require('../../config/security.config');

/**
 * GET /health
 * Production: minimal safe payload (no internal config/secrets).
 * Non-production / HEALTH_EXPOSE_METRICS=true: include cache/queue metrics.
 */
function getHealth(req, res) {
  const body = {
    status: 'ok',
    uptimeSec: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  };

  if (!securityConfig.healthExposeMetrics) {
    return res.json(body);
  }

  const detailStats = getDetailCache().getStats();
  const streamStats = getStreamCache().getStats();
  const htmlStats = getHtmlPageCache().getStats();

  return res.json({
    ...body,
    detailCache: summarizeCache(detailStats),
    streamCache: summarizeCache(streamStats),
    htmlCache: {
      enabled: htmlStats.enabled,
      size: htmlStats.size,
      hitRate: htmlStats.hitRate,
    },
    outboundQueue: typeof defaultQueue.stats === 'function' ? defaultQueue.stats() : null,
    metrics: {
      averageApiResponseMs: getMetrics().averageApiMs(),
      uptimeSec: getMetrics().snapshot().uptimeSec,
      memory: getMetrics().snapshot().memory,
      cacheHitRates: {
        html: htmlStats.hitRate,
        detailMemory: hitRate(detailStats.memory),
        streamMemory: hitRate(streamStats.memory),
      },
    },
  });
}

function summarizeCache(stats) {
  return {
    ttlMs: stats.ttlMs,
    memorySize: stats.memory?.size,
    hitRate: hitRate(stats.memory),
  };
}

function hitRate(memStats) {
  if (!memStats) {
    return 0;
  }
  const hits = memStats.hits || 0;
  const misses = memStats.misses || 0;
  const total = hits + misses;
  return total ? Math.round((hits / total) * 1000) / 10 : 0;
}

module.exports = { getHealth };
