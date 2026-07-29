'use strict';

const { MemoryStore } = require('./base/MemoryStore');
const { FileStore } = require('./base/FileStore');
const { CacheFacade } = require('./base/CacheFacade');
const { cacheConfig } = require('../../config/cache.config');
const { shortHash } = require('../../utils/hash.util');
const { canonicalizeUrl } = require('../../utils/url.util');

/**
 * Dedicated Stream Cache — keyed by child video URL.
 * Stores m3u8 URL, created/expire times, validation status.
 * Store backend is swappable (Redis later) via CacheFacade/ICacheStore.
 */
class StreamCache {
  /**
   * @param {object} [options]
   */
  constructor(options = {}) {
    this.ttlMs = options.ttlMs ?? cacheConfig.streamTtlMs;
    this.graceMs = options.graceMs ?? cacheConfig.streamGraceMs;
    const ramOnly = options.ramOnly ?? cacheConfig.streamRamOnly;
    this.facade = new CacheFacade({
      namespace: 'stream',
      ttlMs: this.ttlMs,
      memory: new MemoryStore({
        maxEntries: options.maxEntries || cacheConfig.streamMaxMemoryEntries,
      }),
      file: ramOnly ? null : new FileStore({ dir: options.dir || cacheConfig.streamDir }),
    });
    /** @type {Map<string, object>} last-known good entries for stale fallback */
    this._lastGood = new Map();
    this._lastGoodMax = options.lastGoodMax || 5000;
  }

  keyForUrl(url) {
    return shortHash(canonicalizeUrl(url), 24);
  }

  /**
   * @param {string} url
   * @param {object} [options]
   * @param {boolean} [options.allowStale]
   */
  async get(url, options = {}) {
    const key = this.keyForUrl(url);
    const result = await this.facade.get(key);
    if (result.value) {
      return { hit: true, stale: false, entry: result.value, source: result.source };
    }

    if (options.allowStale) {
      const last = this._lastGood.get(key);
      if (last && this._isWithinGrace(last)) {
        return { hit: true, stale: true, entry: last, source: 'lastGood' };
      }
    }

    return { hit: false, stale: false, entry: null, source: null };
  }

  /**
   * @param {string} url
   * @param {object} streamPayload
   */
  async set(url, streamPayload) {
    const now = Date.now();
    const entry = {
      pageUrl: canonicalizeUrl(url),
      m3u8: streamPayload.url,
      type: streamPayload.type || 'm3u8',
      validationStatus: streamPayload.validationStatus || 'valid',
      createdAt: now,
      expiresAt: now + this.ttlMs,
      cachedAt: new Date(now).toISOString(),
      expireAtIso: new Date(now + this.ttlMs).toISOString(),
      payload: streamPayload,
    };

    await this.facade.set(this.keyForUrl(url), entry);
    this._remember(entry);
    return entry;
  }

  _remember(entry) {
    const key = this.keyForUrl(entry.pageUrl);
    if (this._lastGood.has(key)) {
      this._lastGood.delete(key);
    }
    while (this._lastGood.size >= this._lastGoodMax) {
      const oldest = this._lastGood.keys().next().value;
      this._lastGood.delete(oldest);
    }
    this._lastGood.set(key, entry);
  }

  _isWithinGrace(entry) {
    if (!entry?.createdAt) {
      return false;
    }
    return Date.now() - entry.createdAt <= this.ttlMs + this.graceMs;
  }

  cleanup() {
    const facadeResult = this.facade.cleanup();
    const now = Date.now();
    let lastGoodRemoved = 0;
    for (const [key, entry] of this._lastGood.entries()) {
      if (!this._isWithinGrace(entry) || (entry.expiresAt && now > entry.expiresAt + this.graceMs)) {
        this._lastGood.delete(key);
        lastGoodRemoved += 1;
      }
    }
    return Promise.resolve(facadeResult).then((r) => ({
      ...r,
      lastGoodRemoved,
    }));
  }

  getStats() {
    return {
      ...this.facade.getStats(),
      lastGoodSize: this._lastGood.size,
      ttlMs: this.ttlMs,
      graceMs: this.graceMs,
    };
  }
}

module.exports = { StreamCache };
