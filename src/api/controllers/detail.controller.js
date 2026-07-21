'use strict';

const { DetailService } = require('../../application/detail/DetailService');
const { createLogger } = require('../../infrastructure/logging/logger');

const logger = createLogger('api.detail');
const detailService = new DetailService();

/**
 * GET /detail?url=<child_video_url>
 */
async function getDetail(req, res, next) {
  try {
    const url = String(req.validatedUrl || req.query.url || '').trim();
    const result = await detailService.getDetail(url);

    if (result._meta?.cacheHit) {
      res.setHeader('X-Cache', 'HIT');
    } else {
      res.setHeader('X-Cache', 'MISS');
    }
    if (result._meta?.durationMs != null) {
      res.setHeader('X-Response-Time', `${result._meta.durationMs}ms`);
    }

    logger.info('Detail response', {
      requestId: req.requestId,
      cacheHit: result._meta?.cacheHit,
      relatedCount: result.related?.length,
      durationMs: result._meta?.durationMs,
    });

    const { _meta, ...body } = result;
    res.json(body);
  } catch (error) {
    next(error);
  }
}

module.exports = { getDetail };
