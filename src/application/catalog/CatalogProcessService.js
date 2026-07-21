'use strict';

const { normalizeVideoList } = require('../../scrapers/normalizers/videoItem.normalizer');
const { createLogger } = require('../../infrastructure/logging/logger');

const logger = createLogger('processing');

/**
 * Reusable catalog processing: normalize, validate, dedupe, sort.
 * Does not scrape and does not know about GitHub.
 */
class CatalogProcessService {
  /**
   * @param {Array<object>} rawItems
   * @param {object} [options]
   * @param {string} [options.section]
   * @param {string} [options.siteId]
   * @returns {Array<{title:string,img:string,url:string}>}
   */
  processItems(rawItems, options = {}) {
    const { items, dropped, duplicates } = normalizeVideoList(rawItems || [], {
      logger,
      siteId: options.siteId,
      section: options.section,
    });

    const sorted = [...items].sort((a, b) => {
      const byUrl = a.url.localeCompare(b.url);
      if (byUrl !== 0) {
        return byUrl;
      }
      return a.title.localeCompare(b.title);
    });

    logger.debug('Processed catalog items', {
      section: options.section,
      siteId: options.siteId,
      input: (rawItems || []).length,
      output: sorted.length,
      dropped,
      duplicates,
    });

    return sorted;
  }

  /**
   * Merge multiple scrapes then process once.
   * @param {Array<Array<object>>} batches
   * @param {object} [options]
   */
  processBatches(batches, options = {}) {
    const merged = [];
    for (const batch of batches || []) {
      merged.push(...(batch || []));
    }
    return this.processItems(merged, options);
  }
}

module.exports = { CatalogProcessService };
