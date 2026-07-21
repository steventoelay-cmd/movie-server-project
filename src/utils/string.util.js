'use strict';

/**
 * @param {unknown} value
 * @returns {string}
 */
function trimString(value) {
  return String(value == null ? '' : value).trim();
}

/**
 * Collapse internal whitespace.
 * @param {string} value
 * @returns {string}
 */
function collapseWhitespace(value) {
  return trimString(value).replace(/\s+/g, ' ');
}

module.exports = {
  trimString,
  collapseWhitespace,
};
