'use strict';

const { isValidHttpUrl } = require('./url.util');
const { trimString } = require('./string.util');

/**
 * Validate a scraped list item. Invalid items are ignored by normalizers.
 * @param {object} item
 * @returns {{ valid: boolean, reason?: string }}
 */
function validateVideoItem(item) {
  if (!item || typeof item !== 'object') {
    return { valid: false, reason: 'not_an_object' };
  }

  const title = trimString(item.title);
  const img = trimString(item.img || item.image);
  const url = trimString(item.url);

  if (!title) {
    return { valid: false, reason: 'missing_title' };
  }
  if (!url || !isValidHttpUrl(url)) {
    return { valid: false, reason: 'invalid_url' };
  }
  if (img && !isValidHttpUrl(img)) {
    return { valid: false, reason: 'invalid_image' };
  }

  return { valid: true };
}

module.exports = {
  validateVideoItem,
};
