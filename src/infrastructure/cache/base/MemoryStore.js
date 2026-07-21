'use strict';

/**
 * In-memory LRU-ish store for cache L1.
 * Compatible with future Redis via ICacheStore shape: get/set/del/clear/stats.
 * See `./ICacheStore.js` and docs/SCALABILITY.md.
 */
class MemoryStore {
  /**
   * @param {object} [options]
   * @param {number} [options.maxEntries]
   */
  constructor(options = {}) {
    this.maxEntries = options.maxEntries || 2000;
    /** @type {Map<string, { value: *, expiresAt: number }>} */
    this._map = new Map();
    this.stats = { hits: 0, misses: 0, sets: 0, deletes: 0 };
  }

  /**
   * @param {string} key
   */
  get(key) {
    const entry = this._map.get(key);
    if (!entry) {
      this.stats.misses += 1;
      return null;
    }
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this._map.delete(key);
      this.stats.misses += 1;
      return null;
    }
    // refresh LRU order
    this._map.delete(key);
    this._map.set(key, entry);
    this.stats.hits += 1;
    return entry.value;
  }

  /**
   * @param {string} key
   * @param {*} value
   * @param {number} ttlMs
   */
  set(key, value, ttlMs) {
    if (this._map.has(key)) {
      this._map.delete(key);
    }
    while (this._map.size >= this.maxEntries) {
      const oldest = this._map.keys().next().value;
      this._map.delete(oldest);
    }
    this._map.set(key, {
      value,
      expiresAt: ttlMs > 0 ? Date.now() + ttlMs : 0,
    });
    this.stats.sets += 1;
  }

  /**
   * @param {string} key
   */
  del(key) {
    const ok = this._map.delete(key);
    if (ok) {
      this.stats.deletes += 1;
    }
    return ok;
  }

  clear() {
    this._map.clear();
  }

  /**
   * Remove expired entries.
   * @returns {number}
   */
  cleanup() {
    const now = Date.now();
    let removed = 0;
    for (const [key, entry] of this._map.entries()) {
      if (entry.expiresAt && now > entry.expiresAt) {
        this._map.delete(key);
        removed += 1;
      }
    }
    return removed;
  }

  getStats() {
    return {
      ...this.stats,
      size: this._map.size,
      maxEntries: this.maxEntries,
    };
  }
}

module.exports = { MemoryStore };
