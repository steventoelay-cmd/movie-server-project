'use strict';

const { hasContentChanged, hashPayload, sanitizeForCompare } = require('../../../utils/jsonCompare.util');

/**
 * Compare JSON payloads for GitHub sync decisions.
 */
class JsonComparer {
  /**
   * @param {*} previous
   * @param {*} next
   * @returns {boolean}
   */
  hasChanged(previous, next) {
    return hasContentChanged(previous, next);
  }

  /**
   * @param {*} payload
   * @returns {string}
   */
  contentHash(payload) {
    return hashPayload(sanitizeForCompare(payload));
  }
}

module.exports = { JsonComparer };
