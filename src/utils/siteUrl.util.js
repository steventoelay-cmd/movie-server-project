'use strict';

/**
 * Join site base URL + list path (supports "/path" and "/?k=query").
 * @param {string} base
 * @param {string} listPath
 * @returns {string}
 */
function joinSiteUrl(base, listPath) {
  const b = String(base || '')
    .trim()
    .replace(/\/+$/, '');
  const p = String(listPath || '').trim();
  if (!b) {
    return '';
  }
  if (!p || p === '/') {
    return b;
  }
  if (p.startsWith('?')) {
    return `${b}/${p}`;
  }
  if (p.startsWith('/')) {
    return `${b}${p}`;
  }
  return `${b}/${p}`;
}

module.exports = { joinSiteUrl };
