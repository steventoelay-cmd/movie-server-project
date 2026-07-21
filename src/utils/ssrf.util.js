'use strict';

const net = require('net');
const { securityConfig } = require('../config/security.config');

/**
 * SSRF protection for user-supplied URLs.
 * Why: Detail/Stream accept ?url= — without this, attackers can probe localhost/cloud metadata.
 */

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'localhost.localdomain',
  'metadata.google.internal',
  'metadata',
]);

/**
 * @param {string} hostname
 * @returns {boolean}
 */
function isLocalhostName(hostname) {
  const h = String(hostname || '').toLowerCase().replace(/\.$/, '');
  return (
    BLOCKED_HOSTNAMES.has(h) ||
    h.endsWith('.localhost') ||
    h.endsWith('.local') ||
    h === '0.0.0.0'
  );
}

/**
 * @param {string} ip
 * @returns {boolean}
 */
function isPrivateOrReservedIp(ip) {
  if (!ip || !net.isIP(ip)) {
    return false;
  }

  // IPv4
  if (net.isIPv4(ip)) {
    const parts = ip.split('.').map(Number);
    const [a, b] = parts;
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true; // link-local / cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    if (a >= 224) return true; // multicast/reserved
    return false;
  }

  // IPv6
  const normalized = ip.toLowerCase();
  if (normalized === '::1' || normalized === '::') return true;
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true; // ULA
  if (normalized.startsWith('fe80')) return true; // link-local
  if (normalized.startsWith('::ffff:')) {
    const v4 = normalized.slice(7);
    return isPrivateOrReservedIp(v4);
  }
  return false;
}

/**
 * Validate URL is safe to fetch (http/https, not private/local).
 * @param {string} rawUrl
 * @param {object} [options]
 * @returns {{ ok: boolean, code?: string, message?: string, url?: URL }}
 */
function assertSafeFetchUrl(rawUrl, options = {}) {
  const blockPrivate = options.blockPrivateIps ?? securityConfig.ssrf.blockPrivateIps;
  const blockLocalhost = options.blockLocalhost ?? securityConfig.ssrf.blockLocalhost;
  const maxLength = options.maxLength || securityConfig.request.urlMaxLength;

  if (rawUrl == null || typeof rawUrl !== 'string' || !rawUrl.trim()) {
    return { ok: false, code: 'URL_REQUIRED', message: 'url query parameter is required' };
  }

  if (rawUrl.length > maxLength) {
    return { ok: false, code: 'URL_TOO_LONG', message: `url exceeds maximum length (${maxLength})` };
  }

  let parsed;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    return { ok: false, code: 'URL_MALFORMED', message: 'url is malformed' };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return {
      ok: false,
      code: 'URL_PROTOCOL_FORBIDDEN',
      message: 'only http and https URLs are allowed',
    };
  }

  // Credentials in URL are a leak/SSRF vector
  if (parsed.username || parsed.password) {
    return {
      ok: false,
      code: 'URL_CREDENTIALS_FORBIDDEN',
      message: 'URLs with embedded credentials are not allowed',
    };
  }

  const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');

  if (blockLocalhost && isLocalhostName(hostname)) {
    return { ok: false, code: 'URL_LOCALHOST_FORBIDDEN', message: 'localhost URLs are not allowed' };
  }

  if (blockPrivate && net.isIP(hostname) && isPrivateOrReservedIp(hostname)) {
    return {
      ok: false,
      code: 'URL_PRIVATE_IP_FORBIDDEN',
      message: 'private or reserved IP addresses are not allowed',
    };
  }

  // Hostname that looks like decimal/hex IP tricks — reject raw IP forms already handled;
  // also reject obvious metadata hostnames
  if (hostname.includes('metadata') && hostname.includes('google')) {
    return { ok: false, code: 'URL_BLOCKED_HOST', message: 'blocked hostname' };
  }

  return { ok: true, url: parsed };
}

module.exports = {
  assertSafeFetchUrl,
  isPrivateOrReservedIp,
  isLocalhostName,
};
