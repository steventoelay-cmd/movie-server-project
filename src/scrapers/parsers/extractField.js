'use strict';

const { resolveUrl } = require('../../utils/url.util');

/**
 * Extract a field from a Cheerio item using attribute rules.
 * Attribute formats: 'text' | 'html' | 'attr:name'
 *
 * @param {import('cheerio').CheerioAPI} $
 * @param {import('cheerio').Cheerio} $item
 * @param {string} selector
 * @param {string} attribute
 * @param {string} [baseUrl]
 * @returns {string}
 */
function extractField($, $item, selector, attribute, baseUrl = '') {
  const $el = selector ? $item.find(selector).first() : $item;
  if (!$el.length) {
    return '';
  }

  let value = '';
  if (attribute === 'text') {
    value = $el.text().trim();
  } else if (attribute === 'html') {
    value = $el.html() || '';
  } else if (attribute && attribute.startsWith('attr:')) {
    const attrName = attribute.slice(5);
    value = $el.attr(attrName) || '';
    if (!value && attrName === 'src') {
      value =
        $el.attr('data-src') ||
        $el.attr('data-lazy-src') ||
        $el.attr('data-original') ||
        '';
    }
    if (!value && attrName === 'data-src') {
      value = $el.attr('src') || $el.attr('data-lazy-src') || $el.attr('data-original') || '';
    }
  } else {
    value = $el.text().trim();
  }

  if (attribute && attribute.startsWith('attr:') && baseUrl && value) {
    const attrName = attribute.slice(5);
    if (['href', 'src', 'data-src', 'data-lazy-src', 'data-original'].includes(attrName)) {
      value = resolveUrl(value, baseUrl);
    }
  }

  return value;
}

module.exports = { extractField };
