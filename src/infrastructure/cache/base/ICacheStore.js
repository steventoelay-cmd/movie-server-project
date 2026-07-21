/**
 * Cache store contract (current + future Redis).
 *
 * MemoryStore and FileStore already implement this shape.
 * A future RedisStore should implement the same methods so
 * CacheFacade / DetailCache / StreamCache need no business-logic changes.
 *
 * @typedef {object} ICacheStore
 * @property {(key: string) => (*|null|Promise<*|null>)} get
 * @property {(key: string, value: *, ttlMs?: number) => (void|Promise<void>)} set
 * @property {(key: string) => (boolean|Promise<boolean>)} del
 * @property {() => (void|Promise<void>)} clear
 * @property {() => object} [getStats]
 * @property {() => (number|Promise<number>|object)} [cleanup]
 */

'use strict';

/** Marker module — documents the store contract; no runtime behavior. */
const ICACHE_STORE_METHODS = Object.freeze(['get', 'set', 'del', 'clear']);

/**
 * Lightweight duck-type check for adapters / tests.
 * @param {object} store
 * @returns {boolean}
 */
function isCacheStore(store) {
  if (!store || typeof store !== 'object') {
    return false;
  }
  return ICACHE_STORE_METHODS.every((m) => typeof store[m] === 'function');
}

module.exports = {
  ICACHE_STORE_METHODS,
  isCacheStore,
};
