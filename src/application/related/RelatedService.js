'use strict';

const { DetailService } = require('../detail/DetailService');
const { createLogger } = require('../../infrastructure/logging/logger');

const logger = createLogger('related');

/**
 * Related videos system — one level only, no nested related, no m3u8.
 * Reuses DetailService scrape/cache so related and detail stay consistent.
 */
class RelatedService {
  /**
   * @param {object} [options]
   * @param {DetailService} [options.detailService]
   */
  constructor(options = {}) {
    this.detailService = options.detailService || new DetailService();
  }

  /**
   * @param {string} url
   * @returns {Promise<{ related: Array, _meta: object }>}
   */
  async getRelated(url) {
    const detail = await this.detailService.getDetail(url);
    logger.info('Related resolved via detail', {
      url,
      relatedCount: detail.related?.length || 0,
      cacheHit: detail._meta?.cacheHit,
    });
    return {
      related: detail.related || [],
      _meta: detail._meta,
    };
  }
}

module.exports = { RelatedService };
