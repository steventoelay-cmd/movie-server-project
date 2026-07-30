'use strict';

const { resolveUrl } = require('../../utils/url.util');

/**
 * xvideos embeds related items in `var video_related = [...]` (not in static DOM).
 * @param {string} html
 * @param {string} pageUrl
 * @returns {Array<{title:string,img:string,url:string}>}
 */
function parseXvideosVideoRelated(html, pageUrl) {
  const match = html.match(/var\s+video_related\s*=\s*(\[[\s\S]*?\])\s*;/);
  if (!match) {
    return [];
  }

  let items;
  try {
    items = JSON.parse(match[1]);
  } catch {
    return [];
  }

  if (!Array.isArray(items)) {
    return [];
  }

  let origin = '';
  try {
    origin = new URL(pageUrl).origin;
  } catch {
    return [];
  }

  return items
    .map((item) => {
      const relUrl = String(item.u || item.url || '').trim();
      if (!relUrl) {
        return null;
      }
      const url = relUrl.startsWith('http') ? relUrl : resolveUrl(relUrl, origin);
      const title = String(item.tf || item.t || item.title || titleFromSlug(relUrl)).trim();
      const img = String(item.i || item.il || item.if || item.ip || item.image || '').trim();
      if (!title) {
        return null;
      }
      return { title, img, url };
    })
    .filter(Boolean);
}

function titleFromSlug(relativeUrl) {
  const slug = String(relativeUrl).split('/').filter(Boolean).pop() || '';
  return slug.replace(/_/g, ' ').replace(/-/g, ' ').trim();
}

/**
 * Site-agnostic script fallbacks when DOM related selectors return nothing.
 * @param {string} html
 * @param {string} pageUrl
 * @returns {Array<{title:string,img:string,url:string}>}
 */
function parseScriptRelated(html, pageUrl) {
  const xv = parseXvideosVideoRelated(html, pageUrl);
  if (xv.length) {
    return xv;
  }
  return [];
}

module.exports = {
  parseScriptRelated,
  parseXvideosVideoRelated,
};
