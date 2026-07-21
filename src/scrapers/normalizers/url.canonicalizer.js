'use strict';

const { canonicalizeUrl } = require('../../utils/url.util');

/**
 * @param {string} url
 * @returns {string}
 */
function canonicalizeItemUrl(url) {
  return canonicalizeUrl(url);
}

module.exports = { canonicalizeItemUrl };
