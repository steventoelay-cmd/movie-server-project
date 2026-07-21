'use strict';

const crypto = require('crypto');

/**
 * @param {string} input
 * @returns {string}
 */
function sha256(input) {
  return crypto.createHash('sha256').update(String(input)).digest('hex');
}

/**
 * Stable short hash for URLs (cache keys, ids).
 * @param {string} input
 * @param {number} [length=16]
 * @returns {string}
 */
function shortHash(input, length = 16) {
  return sha256(input).slice(0, length);
}

module.exports = {
  sha256,
  shortHash,
};
