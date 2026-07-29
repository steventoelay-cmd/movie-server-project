'use strict';

const cheerio = require('cheerio');
const { extractField } = require('./extractField');
const { resolveUrl } = require('../../utils/url.util');

/**
 * Profiles often inject thumbs via document.write(script) — no <img> in static HTML.
 * @param {import('cheerio').CheerioAPI} $
 * @param {import('cheerio').Cheerio} $item
 * @param {string} baseUrl
 * @returns {string}
 */
function extractScriptImage($, $item, baseUrl) {
  const scripts = $item.find('script').toArray();
  for (const node of scripts) {
    const html = $(node).html() || '';
    const match =
      html.match(/src=["'](https?:[^"']+)["']/i) ||
      html.match(/profile_thumb:\\?'(https?:[^'\\]+)['\\]/i) ||
      html.match(/(https?:\/\/[^"'\\\s]+\.(?:jpg|jpeg|png|webp)[^"'\\\s]*)/i);
    if (match && match[1]) {
      return resolveUrl(match[1], baseUrl);
    }
  }
  return '';
}

/**
 * Parse a list page into raw { title, img, url } objects using site selectors.
 * No normalization/validation here — that belongs to normalizers.
 *
 * @param {string} html
 * @param {object} listConfig
 * @param {object} listConfig.selectors
 * @param {object} listConfig.attributes
 * @param {string} pageUrl
 * @returns {Array<{title:string,img:string,url:string}>}
 */
function parseList(html, listConfig, pageUrl) {
  if (!listConfig || !listConfig.selectors || !listConfig.selectors.item) {
    return [];
  }

  const $ = cheerio.load(html);
  const { selectors, attributes = {} } = listConfig;
  const items = [];

  $(selectors.item).each((_, element) => {
    const $item = $(element);
    let title = extractField($, $item, selectors.title || '', attributes.title || 'text', pageUrl);
    let img = extractField($, $item, selectors.image || '', attributes.image || 'attr:src', pageUrl);
    let url = extractField($, $item, selectors.url || '', attributes.url || 'attr:href', pageUrl);

    // Skip blank lightbox placeholder if script has the real thumb.
    if (!img || /lightbox-blank|blank\.gif|spacer/i.test(img)) {
      const fromScript = extractScriptImage($, $item, pageUrl);
      if (fromScript) img = fromScript;
    }

    if (url) {
      url = resolveUrl(url, pageUrl);
    }
    if (img) {
      img = resolveUrl(img, pageUrl);
    }

    // Drop script pollution / rank noise from titles when possible.
    if (title && /document\.write|xv\.thumbs/i.test(title)) {
      title = '';
    }
    title = (title || '').replace(/^#\d+\s*/u, '').trim();
    // Tags index appends counts: "0-pussy 104,303"
    if (url && /\/tags\//i.test(url)) {
      title = title.replace(/\s[\d,]+\s*$/u, '').trim();
    }

    if (!title && !img && !url) {
      return;
    }

    items.push({ title, img, url });
  });

  return items;
}

module.exports = { parseList, extractScriptImage };
