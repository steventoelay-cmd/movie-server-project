'use strict';

const { canonicalizeUrl } = require('./url.util');
const { shortHash } = require('./hash.util');

/**
 * Stable Flutter-facing item id from a video/parent URL.
 * Matches Contract v1 recommendation: sha256(canonicalUrl).slice(0, 16)
 *
 * @param {string} url
 * @returns {string}
 */
function itemIdFromUrl(url) {
  const canonical = canonicalizeUrl(url);
  if (!canonical) {
    return '';
  }
  return shortHash(canonical, 16);
}

module.exports = { itemIdFromUrl };
