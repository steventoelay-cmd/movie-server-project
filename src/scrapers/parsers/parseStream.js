'use strict';

const cheerio = require('cheerio');
const { resolveUrl } = require('../../utils/url.util');
const { extractField } = require('./extractField');

/**
 * @param {string} html
 * @param {Array<string|RegExp>} patterns
 * @returns {string|null}
 */
function matchPatterns(html, patterns = []) {
  for (const pattern of patterns) {
    const regex = pattern instanceof RegExp ? pattern : new RegExp(pattern, 'i');
    const match = html.match(regex);
    if (match && match[1]) {
      return match[1].replace(/\\u0026/g, '&').replace(/\\\//g, '/');
    }
    if (match && match[0] && !match[1]) {
      const urlMatch = match[0].match(/https?:\/\/[^\s"'<>\\]+/);
      if (urlMatch) {
        return urlMatch[0].replace(/\\u0026/g, '&').replace(/\\\//g, '/');
      }
    }
  }
  return null;
}

/**
 * @param {import('cheerio').CheerioAPI} $
 * @param {object} selectorConfig
 * @param {string} baseUrl
 * @returns {string|null}
 */
function extractFromSelector($, selectorConfig, baseUrl) {
  if (!selectorConfig?.selector) {
    return null;
  }
  const $el = $(selectorConfig.selector).first();
  if (!$el.length) {
    return null;
  }
  const attribute = selectorConfig.attribute || 'attr:src';
  const value = extractField($, $el, '', attribute, baseUrl);
  return value || null;
}

/**
 * @param {import('cheerio').CheerioAPI} $
 * @param {Array} patterns
 * @returns {string|null}
 */
function extractFromScripts($, patterns = []) {
  let found = null;
  $('script').each((_, el) => {
    if (found) {
      return;
    }
    const content = $(el).html() || '';
    found = matchPatterns(content, patterns);
  });
  return found;
}

/**
 * Extract playable stream URLs from a child video page.
 * Prefers m3u8. Never used by Detail API.
 *
 * @param {string} html
 * @param {object} streamConfig - site streamConfig / videoExtraction
 * @param {string} pageUrl
 * @returns {{ m3u8: string|null, mp4: string|null, iframeSrc: string|null }}
 */
function parseStream(html, streamConfig, pageUrl) {
  const $ = cheerio.load(html);
  const settings = streamConfig?.videoExtraction || streamConfig || {};
  const baseUrl = pageUrl || '';

  let m3u8 = null;
  let mp4 = null;

  if (settings.selectors?.m3u8) {
    m3u8 = extractFromSelector($, settings.selectors.m3u8, baseUrl);
  }
  if (settings.selectors?.mp4) {
    mp4 = extractFromSelector($, settings.selectors.mp4, baseUrl);
  }

  if (!m3u8 && settings.m3u8Patterns?.length) {
    m3u8 = matchPatterns(html, settings.m3u8Patterns);
  }
  if (!mp4 && settings.mp4Patterns?.length) {
    mp4 = matchPatterns(html, settings.mp4Patterns);
  }

  if (!m3u8 && settings.scriptM3u8Patterns?.length) {
    m3u8 = extractFromScripts($, settings.scriptM3u8Patterns);
  }
  if (!mp4 && settings.scriptMp4Patterns?.length) {
    mp4 = extractFromScripts($, settings.scriptMp4Patterns);
  }

  $('meta[property="og:video"], meta[property="og:video:url"]').each((_, el) => {
    const content = $(el).attr('content') || '';
    if (!content) {
      return;
    }
    if (!m3u8 && content.includes('.m3u8')) {
      m3u8 = content;
    } else if (!mp4 && content.includes('.mp4')) {
      mp4 = content;
    }
  });

  if (!m3u8) {
    $('source[type="application/x-mpegURL"], source[src*=".m3u8"], video[src*=".m3u8"]').each(
      (_, el) => {
        if (!m3u8) {
          m3u8 = $(el).attr('src') || null;
        }
      },
    );
  }

  if (!mp4) {
    $('video source[type="video/mp4"], video[src*=".mp4"]').each((_, el) => {
      if (!mp4) {
        mp4 = $(el).attr('src') || null;
      }
    });
  }

  let iframeSrc = null;
  if (settings.followIframe) {
    const iframeSelector =
      settings.iframeSelector || 'iframe.player, iframe#player, iframe[src*="embed"]';
    iframeSrc = $(iframeSelector).first().attr('src') || null;
    if (iframeSrc) {
      iframeSrc = resolveUrl(iframeSrc, baseUrl);
    }
  }

  if (m3u8) {
    m3u8 = resolveUrl(m3u8, baseUrl);
  }
  if (mp4) {
    mp4 = resolveUrl(mp4, baseUrl);
  }

  return { m3u8, mp4, iframeSrc };
}

module.exports = {
  parseStream,
  matchPatterns,
};
