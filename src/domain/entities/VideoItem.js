'use strict';

const { itemIdFromUrl } = require('../../utils/itemId.util');

/**
 * Canonical list/detail item shape used across Home and child lists.
 * @typedef {object} VideoItem
 * @property {string} id - stable short hash of canonical url (Flutter list keys)
 * @property {string} title
 * @property {string} img
 * @property {string} url
 */

/**
 * @param {object} partial
 * @returns {VideoItem}
 */
function createVideoItem(partial = {}) {
  const url = String(partial.url || '').trim();
  return {
    id: String(partial.id || '').trim() || (url ? itemIdFromUrl(url) : ''),
    title: String(partial.title || '').trim(),
    img: String(partial.img || partial.image || '').trim(),
    url,
  };
}

module.exports = {
  createVideoItem,
};
