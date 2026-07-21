'use strict';

const { MemoryStore } = require('./base/MemoryStore');
const { FileStore } = require('./base/FileStore');
const { CacheFacade } = require('./base/CacheFacade');
const { cacheConfig } = require('../../config/cache.config');
const { shortHash } = require('../../utils/hash.util');
const { canonicalizeUrl } = require('../../utils/url.util');

/**
 * Dedicated Detail Cache — keyed by child video URL.
 * Stores title, image, description, metadata, related, created/expire times.
 */
class DetailCache {
  /**
   * @param {object} [options]
   */
  constructor(options = {}) {
    const ttlMs = options.ttlMs ?? cacheConfig.detailTtlMs;
    this.ttlMs = ttlMs;
    this.facade = new CacheFacade({
      namespace: 'detail',
      ttlMs,
      memory: new MemoryStore({ maxEntries: options.maxEntries || cacheConfig.maxMemoryEntries }),
      file: new FileStore({ dir: options.dir || cacheConfig.detailDir }),
    });
  }

  /**
   * @param {string} url
   * @returns {string}
   */
  keyForUrl(url) {
    return shortHash(canonicalizeUrl(url), 24);
  }

  /**
   * @param {string} url
   */
  async get(url) {
    const result = await this.facade.get(this.keyForUrl(url));
    if (!result.value) {
      return { hit: false, entry: null, source: null };
    }
    return { hit: true, entry: result.value, source: result.source };
  }

  /**
   * @param {string} url
   * @param {object} detailPayload - API-facing detail object
   */
  async set(url, detailPayload) {
    const now = Date.now();
    const entry = {
      url: canonicalizeUrl(url),
      title: detailPayload.title,
      img: detailPayload.img,
      description: detailPayload.description,
      metadata: detailPayload.metadata,
      related: detailPayload.related,
      // future-compatible extras preserved
      schemaVersion: detailPayload.schemaVersion,
      extensions: detailPayload.extensions || {},
      createdAt: now,
      expiresAt: now + this.ttlMs,
      cachedAt: new Date(now).toISOString(),
      expireAtIso: new Date(now + this.ttlMs).toISOString(),
      payload: detailPayload,
    };
    await this.facade.set(this.keyForUrl(url), entry);
    return entry;
  }

  /**
   * Single-flight load for identical URLs.
   * @param {string} url
   * @param {() => Promise<object>} loader - returns API detail payload
   */
  async getOrLoad(url, loader) {
    const result = await this.facade.getOrSet(this.keyForUrl(url), async () => {
      const payload = await loader();
      const now = Date.now();
      return {
        url: canonicalizeUrl(url),
        title: payload.title,
        img: payload.img,
        description: payload.description,
        metadata: payload.metadata,
        related: payload.related,
        schemaVersion: payload.schemaVersion,
        extensions: payload.extensions || {},
        createdAt: now,
        expiresAt: now + this.ttlMs,
        cachedAt: new Date(now).toISOString(),
        expireAtIso: new Date(now + this.ttlMs).toISOString(),
        payload,
      };
    });

    return {
      cacheHit: result.cacheHit,
      source: result.source,
      detail: result.value.payload || this._toPayload(result.value),
      entry: result.value,
    };
  }

  _toPayload(entry) {
    return {
      schemaVersion: entry.schemaVersion || 1,
      title: entry.title,
      img: entry.img,
      description: entry.description,
      metadata: entry.metadata,
      related: entry.related,
      extensions: entry.extensions || {},
    };
  }

  cleanup() {
    return this.facade.cleanup();
  }

  getStats() {
    return this.facade.getStats();
  }
}

module.exports = { DetailCache };
