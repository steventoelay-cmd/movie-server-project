'use strict';

const { FileStore } = require('./base/FileStore');
const { cacheConfig } = require('../../config/cache.config');
const { shortHash } = require('../../utils/hash.util');
const { canonicalizeUrl } = require('../../utils/url.util');

/**
 * SSD cache for related video lists (8h default). Keeps large lists off RAM.
 */
class RelatedSsdCache {
  constructor(options = {}) {
    this.ttlMs = options.ttlMs ?? cacheConfig.relatedTtlMs;
    this.store = new FileStore({ dir: options.dir || cacheConfig.relatedDir });
  }

  keyForUrl(url) {
    return shortHash(canonicalizeUrl(url), 24);
  }

  async set(url, relatedItems) {
    await this.store.set(
      this.keyForUrl(url),
      { related: relatedItems, url: canonicalizeUrl(url) },
      this.ttlMs,
    );
  }

  async get(url) {
    const value = await this.store.get(this.keyForUrl(url));
    if (!value?.related) {
      return { hit: false, related: null };
    }
    return { hit: true, related: value.related };
  }

  cleanup() {
    return this.store.cleanup();
  }
}

let singleton = null;

function getRelatedSsdCache() {
  if (!singleton) {
    singleton = new RelatedSsdCache();
  }
  return singleton;
}

module.exports = { RelatedSsdCache, getRelatedSsdCache };
