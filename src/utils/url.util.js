'use strict';

/**
 * @param {string} url
 * @returns {boolean}
 */
function isValidHttpUrl(url) {
  if (!url || typeof url !== 'string') {
    return false;
  }
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Resolve relative URL against a base.
 * @param {string} href
 * @param {string} baseUrl
 * @returns {string}
 */
function resolveUrl(href, baseUrl) {
  if (!href) {
    return '';
  }
  try {
    return new URL(href, baseUrl).href;
  } catch {
    return href;
  }
}

/**
 * Canonicalize URL for dedupe (strip hash, trailing slash, lowercase host).
 * @param {string} url
 * @returns {string}
 */
function canonicalizeUrl(url) {
  if (!url || typeof url !== 'string') {
    return '';
  }
  try {
    const u = new URL(url);
    u.hash = '';
    u.hostname = u.hostname.toLowerCase();
    let path = u.pathname.replace(/\/+$/, '');
    if (!path) {
      path = '/';
    }
    u.pathname = path;
    return u.href;
  } catch {
    return url.trim().replace(/\/+$/, '');
  }
}

/**
 * @param {string} url
 * @returns {string}
 */
function stripTrailingSlash(url) {
  if (!url) {
    return '';
  }
  return url.replace(/\/+$/, '');
}

module.exports = {
  isValidHttpUrl,
  resolveUrl,
  canonicalizeUrl,
  stripTrailingSlash,
};
