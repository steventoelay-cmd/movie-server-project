'use strict';

const { StreamService } = require('../../application/stream/StreamService');
const { createLogger } = require('../../infrastructure/logging/logger');

const logger = createLogger('api.stream');
const streamService = new StreamService();

/**
 * GET /stream?url=<child_video_url>
 */
async function getStream(req, res, next) {
  try {
    const url = String(req.validatedUrl || req.query.url || '').trim();
    const fresh = req.query.fresh === '1' || req.query.fresh === 'true';
    const result = await streamService.getStream(url, { bypassCache: fresh });

    res.setHeader('X-Cache', result.cache?.hit ? (result.cache.stale ? 'STALE' : 'HIT') : 'MISS');
    if (result.meta?.durationMs != null) {
      res.setHeader('X-Response-Time', `${result.meta.durationMs}ms`);
    }

    logger.info('Stream response', {
      requestId: req.requestId,
      cacheHit: result.cache?.hit,
      stale: result.cache?.stale,
      durationMs: result.meta?.durationMs,
      siteId: result.meta?.siteId,
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
}

module.exports = { getStream };
