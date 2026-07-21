'use strict';

/**
 * Per-key single-flight lock. Concurrent callers for the same key share one promise.
 */
class PromiseLock {
  constructor() {
    /** @type {Map<string, Promise<*>>} */
    this._inflight = new Map();
  }

  /**
   * @template T
   * @param {string} key
   * @param {() => Promise<T>} fn
   * @returns {Promise<T>}
   */
  async run(key, fn) {
    const existing = this._inflight.get(key);
    if (existing) {
      return existing;
    }

    const promise = (async () => {
      try {
        return await fn();
      } finally {
        this._inflight.delete(key);
      }
    })();

    this._inflight.set(key, promise);
    return promise;
  }

  size() {
    return this._inflight.size;
  }
}

module.exports = { PromiseLock };
