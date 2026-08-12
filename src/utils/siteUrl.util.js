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

/**
 * Current xvideos monthly best path, e.g. `/best/2026-08` (UTC month).
 * @returns {string}
 */
function currentBestMonthPath() {
  const now = new Date();
  const ym = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  return `/best/${ym}`;
}

/**
 * Resolve HOME_LIST_PATH for xvideos home scrapes.
 * `/best/current` → current month. Stale `/best/YYYY-MM` rolls forward when auto enabled.
 *
 * @param {string} listPath
 * @param {{ autoCurrentMonth?: boolean }} [options]
 * @returns {string}
 */
function resolveHomeListPath(listPath, options = {}) {
  const autoCurrentMonth = options.autoCurrentMonth !== false;
  const raw = String(listPath || '/best/current').trim();

  if (raw === '/best/current' || raw === '/best/auto') {
    return currentBestMonthPath();
  }

  if (autoCurrentMonth) {
    const match = raw.match(/^\/best\/(\d{4})-(\d{2})$/);
    if (match) {
      const configured = `${match[1]}-${match[2]}`;
      const current = currentBestMonthPath().slice('/best/'.length);
      if (configured < current) {
        return `/best/${current}`;
      }
    }
  }

  return raw;
}

module.exports = { joinSiteUrl, currentBestMonthPath, resolveHomeListPath };
