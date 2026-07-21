'use strict';

const { shortHash } = require('./hash.util');

/**
 * Build a stable filesystem-safe parent id from URL + title.
 * @param {{ url: string, title?: string }} parent
 * @returns {string}
 */
function parentIdFromItem(parent) {
  const url = String(parent?.url || '').trim();
  let slug = 'item';
  try {
    const u = new URL(url);
    const parts = u.pathname.split('/').filter(Boolean);
    slug = parts[parts.length - 1] || parts[parts.length - 2] || 'item';
  } catch {
    slug = String(parent?.title || 'item');
  }

  const safe = slug
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'item';

  return `${safe}-${shortHash(url, 10)}`;
}

module.exports = { parentIdFromItem };
