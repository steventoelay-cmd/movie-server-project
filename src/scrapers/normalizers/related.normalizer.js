'use strict';

const { normalizeVideoList } = require('./videoItem.normalizer');
const { canonicalizeItemUrl } = require('./url.canonicalizer');

/**
 * Normalize one-level related video list only.
 * @param {Array} rawRelated
 * @param {string} [sourceUrl]
 * @param {object} [options]
 */
function normalizeRelated(rawRelated, sourceUrl = '', options = {}) {
  const { items, dropped, duplicates } = normalizeVideoList(rawRelated || [], {
    logger: options.logger,
    siteId: options.siteId,
    section: 'related',
  });

  const self = sourceUrl ? canonicalizeItemUrl(sourceUrl) : '';
  const related = self ? items.filter((i) => i.url !== self) : items;

  return { related, dropped, duplicates };
}

module.exports = { normalizeRelated };
