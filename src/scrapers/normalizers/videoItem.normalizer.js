'use strict';

const { createVideoItem } = require('../../domain/entities/VideoItem');
const { validateVideoItem } = require('../../utils/validation.util');
const { collapseWhitespace } = require('../../utils/string.util');
const { canonicalizeItemUrl } = require('./url.canonicalizer');

/**
 * Normalize, validate, and dedupe a scraped list.
 * Invalid items are dropped (never crash).
 *
 * @param {Array<object>} rawItems
 * @param {object} [options]
 * @param {object} [options.logger]
 * @param {string} [options.siteId]
 * @param {string} [options.section]
 * @returns {{ items: Array<{title:string,img:string,url:string}>, dropped: number, duplicates: number }}
 */
function normalizeVideoList(rawItems, options = {}) {
  const logger = options.logger;
  const seen = new Set();
  const items = [];
  let dropped = 0;
  let duplicates = 0;

  for (const raw of rawItems || []) {
    const item = createVideoItem({
      title: collapseWhitespace(raw.title),
      img: raw.img || raw.image,
      url: canonicalizeItemUrl(raw.url),
    });

    const check = validateVideoItem(item);
    if (!check.valid) {
      dropped += 1;
      if (logger) {
        logger.debug('Dropped invalid item', {
          siteId: options.siteId,
          section: options.section,
          reason: check.reason,
        });
      }
      continue;
    }

    if (seen.has(item.url)) {
      duplicates += 1;
      continue;
    }
    seen.add(item.url);
    items.push(item);
  }

  return { items, dropped, duplicates };
}

module.exports = { normalizeVideoList };
