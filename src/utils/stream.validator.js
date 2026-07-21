'use strict';

const { isValidHttpUrl } = require('./url.util');

/**
 * Validate extracted stream URL (prefer m3u8).
 * @param {string} url
 * @param {object} [options]
 * @param {boolean} [options.requireM3u8=true]
 * @returns {{ valid: boolean, reason?: string, type?: string }}
 */
function validateStreamUrl(url, options = {}) {
  const requireM3u8 = options.requireM3u8 !== false;

  if (!url || typeof url !== 'string' || !url.trim()) {
    return { valid: false, reason: 'empty_url' };
  }

  const trimmed = url.trim();
  if (!isValidHttpUrl(trimmed)) {
    return { valid: false, reason: 'invalid_url' };
  }

  const lower = trimmed.toLowerCase();

  // Reject obvious non-stream / page leftovers
  if (lower.endsWith('.html') || lower.endsWith('.htm') || lower.includes('/tag/') || lower.includes('/channel/')) {
    return { valid: false, reason: 'unsupported_format' };
  }

  const isM3u8 = lower.includes('.m3u8') || lower.includes('application/x-mpegurl') || lower.includes('m3u8');
  const isMp4 = lower.includes('.mp4');

  if (requireM3u8 && !isM3u8) {
    if (isMp4) {
      return { valid: false, reason: 'unsupported_format', type: 'mp4' };
    }
    return { valid: false, reason: 'unsupported_format' };
  }

  if (!isM3u8 && !isMp4) {
    return { valid: false, reason: 'unsupported_format' };
  }

  // Detectable expiry query params in the past (best-effort)
  try {
    const u = new URL(trimmed);
    const exp =
      u.searchParams.get('expires') ||
      u.searchParams.get('exp') ||
      u.searchParams.get('e');
    if (exp && /^\d+$/.test(exp)) {
      const expNum = Number(exp);
      const expMs = expNum < 1e12 ? expNum * 1000 : expNum;
      if (expMs < Date.now() - 5000) {
        return { valid: false, reason: 'expired_url', type: isM3u8 ? 'm3u8' : 'mp4' };
      }
    }
  } catch {
    return { valid: false, reason: 'invalid_url' };
  }

  return { valid: true, type: isM3u8 ? 'm3u8' : 'mp4' };
}

module.exports = { validateStreamUrl };
