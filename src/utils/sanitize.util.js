'use strict';

/**
 * Mask secrets before logging / error serialization.
 * Why: GitHub tokens and API keys must never appear in logs or client errors.
 */

const SENSITIVE_KEY =
  /^(authorization|cookie|set-cookie|x-api-key|api[_-]?key|token|password|secret|github[_-]?token|admin[_-]?api[_-]?key)$/i;

const SECRET_PATTERNS = [
  /ghp_[A-Za-z0-9_]{20,}/g,
  /github_pat_[A-Za-z0-9_]{20,}/g,
  /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi,
];

/**
 * @param {string} text
 * @returns {string}
 */
function maskString(text) {
  if (!text || typeof text !== 'string') {
    return text;
  }
  let out = text;
  for (const pattern of SECRET_PATTERNS) {
    out = out.replace(pattern, '[REDACTED]');
  }
  return out;
}

/**
 * Deep-clone-ish redact of plain objects for logging.
 * @param {*} value
 * @param {number} [depth]
 * @returns {*}
 */
function redactSensitive(value, depth = 0) {
  if (depth > 6) {
    return '[Truncated]';
  }
  if (value == null) {
    return value;
  }
  if (typeof value === 'string') {
    return maskString(value);
  }
  if (typeof value !== 'object') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((v) => redactSensitive(v, depth + 1));
  }

  const out = {};
  for (const [key, val] of Object.entries(value)) {
    if (SENSITIVE_KEY.test(key)) {
      out[key] = '[REDACTED]';
    } else if (typeof val === 'string') {
      out[key] = maskString(val);
    } else {
      out[key] = redactSensitive(val, depth + 1);
    }
  }
  return out;
}

/**
 * Safe path join under a root — prevents path traversal.
 * @param {string} rootDir
 * @param {string} userPath
 * @returns {{ ok: boolean, path?: string, code?: string, message?: string }}
 */
function assertSafeRelativePath(rootDir, userPath) {
  const path = require('path');
  if (!userPath || typeof userPath !== 'string') {
    return { ok: false, code: 'PATH_REQUIRED', message: 'path is required' };
  }
  if (userPath.includes('\0')) {
    return { ok: false, code: 'PATH_INVALID', message: 'invalid path' };
  }
  const resolvedRoot = path.resolve(rootDir);
  const resolved = path.resolve(rootDir, userPath);
  if (resolved !== resolvedRoot && !resolved.startsWith(resolvedRoot + path.sep)) {
    return { ok: false, code: 'PATH_TRAVERSAL', message: 'path escapes allowed directory' };
  }
  return { ok: true, path: resolved };
}

module.exports = {
  maskString,
  redactSensitive,
  assertSafeRelativePath,
};
