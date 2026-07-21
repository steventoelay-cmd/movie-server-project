'use strict';

const { MemoryStore } = require('./base/MemoryStore');
const { PromiseLock } = require('../concurrency/PromiseLock');
const { performanceConfig } = require('../../config/performance.config');
const { canonicalizeUrl } = require('../../utils/url.util');
const { shortHash } = require('../../utils/hash.util');
const { getMetrics } = require('../metrics/MetricsCollector');

/**
 * Short-TTL HTML page cache — download once, reuse across Detail/Stream/catalog.
 * Memory-only by default (HTML is large); Redis-ready via MemoryStore interface.
 */
class HtmlPageCache {
  /**
   * @param {object} [options]
   */
  constructor(options = {}) {
    this.enabled = options.enabled ?? performanceConfig.htmlCacheEnabled;
    this.ttlMs = options.ttlMs ?? performanceConfig.htmlCacheTtlMs;
    this.store = new MemoryStore({
      maxEntries: options.maxEntries || performanceConfig.htmlCacheMaxEntries,
    });
    this.lock = new PromiseLock();
    this.metrics = options.metrics || getMetrics();
  }

  keyForUrl(url) {
    return shortHash(canonicalizeUrl(url), 24);
  }

  /**
   * @param {string} url
   * @returns {string|null}
   */
  get(url) {
    if (!this.enabled) {
      return null;
    }
    const value = this.store.get(this.keyForUrl(url));
    if (value != null) {
      this.metrics.incr('html_cache.hit');
      return value;
    }
    this.metrics.incr('html_cache.miss');
    return null;
  }

  /**
   * @param {string} url
   * @param {string} html
   */
  set(url, html) {
    if (!this.enabled || typeof html !== 'string') {
      return;
    }
    // Avoid caching enormous pages (protect memory)
    if (html.length > 2_500_000) {
      return;
    }
    this.store.set(this.keyForUrl(url), html, this.ttlMs);
    this.metrics.incr('html_cache.set');
  }

  /**
   * Single-flight load: concurrent callers for same URL share one fetch.
   * @param {string} url
   * @param {() => Promise<string>} loader
   */
  async getOrLoad(url, loader) {
    if (!this.enabled) {
      return loader();
    }
    const cached = this.get(url);
    if (cached != null) {
      return cached;
    }
    return this.lock.run(`html:${this.keyForUrl(url)}`, async () => {
      const again = this.store.get(this.keyForUrl(url));
      if (again != null) {
        this.metrics.incr('html_cache.hit');
        return again;
      }
      this.metrics.incr('html_cache.miss');
      const html = await loader();
      this.set(url, html);
      return html;
    });
  }

  cleanup() {
    return this.store.cleanup();
  }

  getStats() {
    const s = this.store.getStats();
    const hits = this.metrics.counters['html_cache.hit'] || 0;
    const misses = this.metrics.counters['html_cache.miss'] || 0;
    const total = hits + misses;
    return {
      enabled: this.enabled,
      ttlMs: this.ttlMs,
      ...s,
      hitRate: total ? Math.round((hits / total) * 1000) / 10 : 0,
    };
  }
}

let sharedHtmlPageCache = null;

function getHtmlPageCache() {
  if (!sharedHtmlPageCache) {
    sharedHtmlPageCache = new HtmlPageCache();
  }
  return sharedHtmlPageCache;
}

module.exports = {
  HtmlPageCache,
  getHtmlPageCache,
};
