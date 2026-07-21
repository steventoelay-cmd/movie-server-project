'use strict';

const cheerio = require('cheerio');
const { extractField } = require('./extractField');
const { resolveUrl } = require('../../utils/url.util');

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

    if (url) {
      url = resolveUrl(url, pageUrl);
    }
    if (img) {
      img = resolveUrl(img, pageUrl);
    }

    if (!title && !img && !url) {
      return;
    }

    items.push({ title, img, url });
  });

  return items;
}

module.exports = { parseList };
