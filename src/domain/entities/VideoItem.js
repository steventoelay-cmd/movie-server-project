'use strict';

/**
 * Canonical list/detail item shape used across Home and child lists.
 * @typedef {object} VideoItem
 * @property {string} title
 * @property {string} img
 * @property {string} url
 */

/**
 * @param {object} partial
 * @returns {VideoItem}
 */
function createVideoItem(partial = {}) {
  return {
    title: String(partial.title || '').trim(),
    img: String(partial.img || partial.image || '').trim(),
    url: String(partial.url || '').trim(),
  };
}

module.exports = {
  createVideoItem,
};
