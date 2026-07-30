'use strict';

const cheerio = require('cheerio');
const { extractField } = require('./extractField');
const { parseList } = require('./parseList');
const { parseScriptRelated } = require('./parseRelatedScripts');
const { resolveUrl } = require('../../utils/url.util');

/**
 * Extract a single configured field from the page root.
 * @param {import('cheerio').CheerioAPI} $
 * @param {object} fieldConfig - { selector, attribute }
 * @param {string} pageUrl
 * @returns {string}
 */
function extractPageField($, fieldConfig, pageUrl) {
  if (!fieldConfig || !fieldConfig.selector) {
    return '';
  }
  const $root = $.root();
  // Use body as item context for relative selectors
  const $item = $('body').length ? $('body').first() : $root;
  return extractField($, $item, fieldConfig.selector, fieldConfig.attribute || 'text', pageUrl);
}

/**
 * Parse video detail page — never extracts m3u8/stream.
 *
 * @param {string} html
 * @param {object} detailConfig
 * @param {string} pageUrl
 * @returns {{ title: string, img: string, description: string, duration: string, releaseDate: string, category: string, tags: string[], related: Array }}
 */
function parseDetail(html, detailConfig, pageUrl) {
  const fields = detailConfig?.fields || {};
  const $ = cheerio.load(html);

  let title = extractPageField($, fields.title, pageUrl);
  let img = extractPageField($, fields.image, pageUrl);
  let description = extractPageField($, fields.description, pageUrl);
  let duration = extractPageField($, fields.duration, pageUrl);
  let releaseDate = extractPageField($, fields.releaseDate, pageUrl);
  let category = extractPageField($, fields.category, pageUrl);

  // Common OG fallbacks (site-agnostic safety net — only when field empty)
  if (!title) {
    title =
      $('meta[property="og:title"]').attr('content') ||
      $('h1').first().text().trim() ||
      $('title').first().text().trim() ||
      '';
  }
  if (!img) {
    const og = $('meta[property="og:image"]').attr('content') || '';
    img = og ? resolveUrl(og, pageUrl) : '';
  }
  if (!img && fields.image?.selector) {
    const $img = $(fields.image.selector).first();
    const src =
      $img.attr('src') ||
      $img.attr('data-src') ||
      $img.attr('poster') ||
      $img.attr('content') ||
      '';
    if (src) {
      img = resolveUrl(src, pageUrl);
    }
  }
  if (!description) {
    description =
      $('meta[property="og:description"]').attr('content') ||
      $('meta[name="description"]').attr('content') ||
      '';
  }

  if (img) {
    img = resolveUrl(img, pageUrl);
  }

  /** @type {string[]} */
  let tags = [];
  if (fields.tags?.item) {
    $(fields.tags.item).each((_, el) => {
      const text = fields.tags.attribute === 'text' || !fields.tags.attribute
        ? $(el).text().trim()
        : $(el).attr(String(fields.tags.attribute).replace(/^attr:/, '')) || '';
      if (text) {
        tags.push(text);
      }
    });
  }

  let related = [];
  try {
    if (detailConfig?.related?.selectors?.item) {
      related = parseList(html, detailConfig.related, pageUrl);
    }
  } catch {
    related = [];
  }

  if (!related.length) {
    try {
      related = parseScriptRelated(html, pageUrl);
    } catch {
      related = [];
    }
  }

  return {
    title: title.trim(),
    img,
    description: description.trim(),
    duration: duration.trim(),
    releaseDate: releaseDate.trim(),
    category: category.trim(),
    tags,
    related,
  };
}

module.exports = {
  parseDetail,
  extractPageField,
};
