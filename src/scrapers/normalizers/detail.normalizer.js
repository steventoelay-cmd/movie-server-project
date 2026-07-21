'use strict';

const { normalizeVideoList } = require('./videoItem.normalizer');
const { collapseWhitespace } = require('../../utils/string.util');
const { canonicalizeItemUrl } = require('./url.canonicalizer');
const { isValidHttpUrl } = require('../../utils/url.util');

const DETAIL_SCHEMA_VERSION = 1;

/**
 * Build Flutter-compatible detail payload (extensible, no m3u8).
 * Missing optional fields never fail the response.
 *
 * @param {object} raw
 * @param {string} pageUrl
 * @param {object} [options]
 */
function normalizeDetail(raw, pageUrl, options = {}) {
  const relatedResult = normalizeVideoList(raw.related || [], {
    logger: options.logger,
    siteId: options.siteId,
    section: 'related',
  });

  // Exclude self-references from related
  const selfUrl = canonicalizeItemUrl(pageUrl);
  const related = relatedResult.items.filter((item) => item.url !== selfUrl);

  const title = collapseWhitespace(raw.title || '');
  let img = String(raw.img || '').trim();
  if (img && !isValidHttpUrl(img)) {
    img = '';
  }

  return {
    schemaVersion: DETAIL_SCHEMA_VERSION,
    title: title || 'Untitled',
    img,
    description: String(raw.description || '').trim(),
    metadata: {
      duration: String(raw.duration || '').trim(),
      releaseDate: String(raw.releaseDate || '').trim(),
      category: String(raw.category || '').trim(),
      tags: Array.isArray(raw.tags)
        ? [...new Set(raw.tags.map((t) => collapseWhitespace(t)).filter(Boolean))]
        : [],
      // Future-compatible reserved fields (non-breaking for Flutter)
      locale: null,
      subtitles: [],
      rating: null,
    },
    related,
    extensions: {
      sourceUrl: canonicalizeItemUrl(pageUrl),
      relatedDropped: relatedResult.dropped,
      relatedDuplicates: relatedResult.duplicates,
    },
  };
}

module.exports = {
  normalizeDetail,
  DETAIL_SCHEMA_VERSION,
};
