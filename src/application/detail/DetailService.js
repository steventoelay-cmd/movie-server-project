'use strict';

const { createLogger } = require('../../infrastructure/logging/logger');
const { getDetailCache } = require('../../infrastructure/cache');
const { SiteResolver } = require('../../scrapers/core/SiteResolver');
const { PromiseLock } = require('../../infrastructure/concurrency/PromiseLock');
const { canonicalizeUrl } = require('../../utils/url.util');
const { shortHash } = require('../../utils/hash.util');

const logger = createLogger('detail');

/**
 * Video Details use-case.
 * Never extracts m3u8. Uses DetailCache + PromiseLock for single-flight scrapes.
 */
class DetailService {
  /**
   * @param {object} [options]
   * @param {import('../../infrastructure/cache/DetailCache').DetailCache} [options.cache]
   * @param {SiteResolver} [options.resolver]
   */
  constructor(options = {}) {
    this.cache = options.cache || getDetailCache();
    this.resolver = options.resolver || new SiteResolver();
    this.lock = options.lock || new PromiseLock();
  }

  /**
   * @param {string} url - child video page URL
   * @returns {Promise<object>}
   */
  async getDetail(url) {
    const started = Date.now();
    const check = this.resolver.validateChildUrl(url);
    if (!check.ok) {
      const err = new Error(check.message);
      err.statusCode = 400;
      err.code = 'INVALID_DETAIL_URL';
      throw err;
    }

    const canonical = canonicalizeUrl(url);
    const lockKey = `detail:${shortHash(canonical)}`;

    // Outer lock ensures concurrent callers share one scrape even before cache write
    return this.lock.run(lockKey, async () => {
      const cached = await this.cache.get(canonical);
      if (cached.hit && cached.entry?.payload) {
        const durationMs = Date.now() - started;
        logger.info('Detail cache hit', {
          url: canonical,
          source: cached.source,
          relatedCount: cached.entry.payload.related?.length || 0,
          durationMs,
          cacheHit: true,
          memoryMB: optionalMemoryMb(),
        });
        return {
          ...shapeResponse(cached.entry.payload),
          _meta: {
            cacheHit: true,
            source: cached.source,
            durationMs,
            scrapeDurationMs: 0,
            relatedCount: cached.entry.payload.related?.length || 0,
          },
        };
      }

      const scrapeStarted = Date.now();
      const adapter = this.resolver.resolveAdapter(canonical);
      let html;
      try {
        html = await adapter.fetchHtml(canonical);
      } catch (error) {
        logger.error('Detail fetch failed', {
          url: canonical,
          siteId: adapter.siteId,
          message: error.message,
          durationMs: Date.now() - started,
        });
        throw error;
      }

      let detail;
      try {
        detail = adapter.parseDetail(html, canonical);
      } catch (error) {
        // Soft-fail parse: return minimal payload rather than crashing
        logger.warn('Detail parse partial failure', {
          url: canonical,
          siteId: adapter.siteId,
          message: error.message,
        });
        detail = {
          schemaVersion: 1,
          title: 'Untitled',
          img: '',
          description: '',
          metadata: {
            duration: '',
            releaseDate: '',
            category: '',
            tags: [],
            locale: null,
            subtitles: [],
            rating: null,
          },
          related: [],
          extensions: { sourceUrl: canonical, parseError: error.message },
        };
      }

      // Ensure related failure never blanks the whole detail
      if (!Array.isArray(detail.related)) {
        detail.related = [];
      }

      await this.cache.set(canonical, detail);

      const scrapeDurationMs = Date.now() - scrapeStarted;
      const durationMs = Date.now() - started;

      logger.info('Detail scrape complete', {
        url: canonical,
        siteId: adapter.siteId,
        cacheHit: false,
        relatedCount: detail.related.length,
        scrapeDurationMs,
        durationMs,
        memoryMB: optionalMemoryMb(),
      });

      return {
        ...shapeResponse(detail),
        _meta: {
          cacheHit: false,
          source: null,
          siteId: adapter.siteId,
          durationMs,
          scrapeDurationMs,
          relatedCount: detail.related.length,
        },
      };
    });
  }
}

/**
 * Public API body — strips internal-only extension noise if desired later.
 * Keeps schemaVersion + extensions for future Flutter compatibility.
 */
function shapeResponse(detail) {
  return {
    schemaVersion: detail.schemaVersion || 1,
    title: detail.title || '',
    img: detail.img || '',
    description: detail.description || '',
    metadata: {
      duration: detail.metadata?.duration || '',
      releaseDate: detail.metadata?.releaseDate || '',
      category: detail.metadata?.category || '',
      tags: Array.isArray(detail.metadata?.tags) ? detail.metadata.tags : [],
      locale: detail.metadata?.locale ?? null,
      subtitles: Array.isArray(detail.metadata?.subtitles) ? detail.metadata.subtitles : [],
      rating: detail.metadata?.rating ?? null,
    },
    related: Array.isArray(detail.related)
      ? detail.related.map((r) => ({
          title: r.title,
          img: r.img,
          url: r.url,
        }))
      : [],
    extensions: detail.extensions || {},
  };
}

function optionalMemoryMb() {
  try {
    return Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 10) / 10;
  } catch {
    return undefined;
  }
}

module.exports = { DetailService, shapeResponse };
