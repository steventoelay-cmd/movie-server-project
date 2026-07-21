'use strict';

const crypto = require('crypto');

/**
 * Deterministic JSON stringify (sorted object keys).
 * @param {*} value
 * @returns {string}
 */
function stableStringify(value) {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => stableStringify(v)).join(',')}]`;
  }
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
}

/**
 * @param {*} value
 * @returns {string}
 */
function hashPayload(value) {
  return crypto.createHash('sha256').update(stableStringify(value)).digest('hex');
}

/**
 * Strip volatile metadata so formatting/timestamps do not force uploads.
 * @param {*} payload
 * @returns {*}
 */
function sanitizeForCompare(payload) {
  if (!payload || typeof payload !== 'object') {
    return payload;
  }
  const clone = JSON.parse(JSON.stringify(payload));
  const volatile = [
    'generatedAt',
    'lastUpdate',
    'lastUpdateTime',
    'scrapedAt',
    'executionId',
  ];
  for (const key of volatile) {
    delete clone[key];
  }
  if (clone.meta && typeof clone.meta === 'object') {
    for (const key of volatile) {
      delete clone.meta[key];
    }
    delete clone.meta.checksum;
  }
  return clone;
}

/**
 * Content-only comparison (ignores formatting and volatile timestamps).
 * @param {*} previous
 * @param {*} next
 * @returns {boolean}
 */
function hasContentChanged(previous, next) {
  if (!previous) {
    return true;
  }
  return hashPayload(sanitizeForCompare(previous)) !== hashPayload(sanitizeForCompare(next));
}

module.exports = {
  stableStringify,
  hashPayload,
  sanitizeForCompare,
  hasContentChanged,
};
