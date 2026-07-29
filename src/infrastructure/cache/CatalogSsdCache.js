'use strict';

const path = require('path');
const { FileStore } = require('./base/FileStore');
const { cacheConfig } = require('../../config/cache.config');
const { catalogConfig } = require('../../config/catalog.config');
const { shortHash } = require('../../utils/hash.util');

/**
 * SSD-only cache for catalog page JSON (load-more API).
 * Does not keep listing pages in RAM.
 */
class CatalogSsdCache {
  /**
   * @param {object} [options]
   */
  constructor(options = {}) {
    this.ttlMs = options.ttlMs ?? catalogConfig.ssdCacheTtlMs;
    this.store = new FileStore({
      dir: options.dir || cacheConfig.catalogDir,
    });
    this.namespace = 'catalog-page';
  }

  keyForRelPath(relPath) {
    return shortHash(`${this.namespace}:${relPath.replace(/\\/g, '/')}`, 32);
  }

  /**
   * @param {string} relPath - e.g. home/page-5.json
   * @param {object} doc
   */
  async set(relPath, doc) {
    const key = this.keyForRelPath(relPath);
    const now = Date.now();
    await this.store.set(key, {
      relPath,
      doc,
      cachedAt: now,
      expiresAt: now + this.ttlMs,
    }, this.ttlMs);
  }

  /**
   * @param {string} relPath
   */
  async get(relPath) {
    const key = this.keyForRelPath(relPath);
    const entry = await this.store.get(key);
    if (!entry?.doc) {
      return { hit: false, doc: null };
    }
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      return { hit: false, doc: null, expired: true };
    }
    return { hit: true, doc: entry.doc, cachedAt: entry.cachedAt };
  }

  cleanup() {
    return this.store.cleanup();
  }

  getStats() {
    return { ttlMs: this.ttlMs, dir: path.resolve(this.store.dir), ...this.store.getStats() };
  }
}

let singleton = null;

function getCatalogSsdCache() {
  if (!singleton) {
    singleton = new CatalogSsdCache();
  }
  return singleton;
}

module.exports = { CatalogSsdCache, getCatalogSsdCache };
