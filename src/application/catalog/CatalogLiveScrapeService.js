'use strict';

const {
  SECTIONS,
  isFlatListSection,
  isParentChildSection,
  isValidSection,
} = require('../../domain/constants/sections');
const { pipelineConfig } = require('../../config/pipeline.config');
const { catalogConfig } = require('../../config/catalog.config');
const { createScraperEngine } = require('../../scrapers');
const { CatalogProcessService } = require('./CatalogProcessService');
const { buildDocument } = require('./JsonGeneratorService');
const { PromiseLock } = require('../../infrastructure/concurrency/PromiseLock');
const { getCatalogSsdCache } = require('../../infrastructure/cache/CatalogSsdCache');
const { createLogger } = require('../../infrastructure/logging/logger');
const { shortHash } = require('../../utils/hash.util');

const logger = createLogger('catalog-live');

/**
 * Live website scrape for Flutter load-more (page 4+).
 * Flow: SSD cache (8h) → scrape one page → save SSD → return JSON.
 * Does not keep list pages in RAM.
 */
class CatalogLiveScrapeService {
  /**
   * @param {object} [options]
   */
  constructor(options = {}) {
    this.engine = options.engine || createScraperEngine();
    this.processor = options.processor || new CatalogProcessService();
    this.lock = options.lock || new PromiseLock();
    this.ssd = options.ssd || getCatalogSsdCache();
    this.ttlMs = options.ttlMs ?? catalogConfig.ssdCacheTtlMs;
  }

  siteForSection(section) {
    return pipelineConfig.sectionSites[section] || '';
  }

  normalizeSection(raw) {
    const s = String(raw || '').toLowerCase();
    if (s === 'models') return SECTIONS.MODEL;
    if (s === 'channels') return SECTIONS.CHANNEL;
    if (s === 'tags') return SECTIONS.TAG;
    return s;
  }

  liveRelPath(kind, section, page, parentId) {
    if (kind === 'child') {
      return `live/${section}/child/${parentId}/page-${page}.json`;
    }
    return `live/${section}/page-${page}.json`;
  }

  async readSsd(rel) {
    const cached = await this.ssd.get(rel);
    if (cached.hit && cached.doc) {
      return cached.doc;
    }
    return null;
  }

  async writeSsd(rel, doc) {
    await this.ssd.set(rel, doc);
  }

  /**
   * Live scrape one flat list page (home / myanmar) for GET /loadmore.
   * Used for any page when CDN JSON is missing (e.g. myanmar page 2+).
   */
  async scrapeFlatPage(section, page) {
    const sec = this.normalizeSection(section);
    if (!isValidSection(sec) || !isFlatListSection(sec)) {
      const err = new Error(`Invalid flat section: ${section}`);
      err.statusCode = 400;
      err.code = 'INVALID_SECTION';
      throw err;
    }

    const pageNum = Math.max(1, Number(page) || 1);
    const rel = this.liveRelPath('flat', sec, pageNum);
    const lockKey = `live:${rel}`;

    const cached = await this.readSsd(rel);
    if (cached) {
      return { ...cached, _meta: { cacheHit: true, source: 'ssd', relPath: rel } };
    }

    return this.lock.run(lockKey, async () => {
      const again = await this.readSsd(rel);
      if (again) {
        return { ...again, _meta: { cacheHit: true, source: 'ssd', relPath: rel } };
      }

      const siteId = this.siteForSection(sec);
      if (!siteId) {
        const err = new Error(`No site configured for ${sec}`);
        err.statusCode = 501;
        err.code = 'NO_SITE';
        throw err;
      }

      const started = Date.now();
      let result;
      if (sec === SECTIONS.HOME) {
        result = await this.engine.scrapeHome(siteId, { page: pageNum });
      } else {
        result = await this.engine.scrapeMyanmar(siteId, { page: pageNum });
      }

      const items = this.processor.processItems(result.items || [], {
        section: sec,
        siteId,
      });
      result.items = null;

      const hasNext = items.length > 0;
      const doc = buildDocument({
        section: sec,
        page: pageNum,
        items,
        hasNext,
        extraMeta: {
          kind: 'list',
          source: 'live-scrape',
          siteId,
          scrapeUrl: result.url || '',
        },
      });

      await this.writeSsd(rel, doc);
      logger.info('Live flat scrape complete', {
        section: sec,
        page: pageNum,
        items: items.length,
        hasNext,
        durationMs: Date.now() - started,
        url: result.url,
        ssd: rel,
      });

      return {
        ...doc,
        _meta: {
          cacheHit: false,
          source: 'live-scrape',
          durationMs: Date.now() - started,
          relPath: rel,
        },
      };
    });
  }

  /**
   * Live scrape children page 4+ under a parent.
   */
  async scrapeChildPage(section, parentId, page, parentUrl) {
    const sec = this.normalizeSection(section);
    if (!isValidSection(sec) || !isParentChildSection(sec)) {
      const err = new Error(`Invalid parent-child section: ${section}`);
      err.statusCode = 400;
      err.code = 'INVALID_SECTION';
      throw err;
    }

    const url = String(parentUrl || '').trim();
    if (!url) {
      const err = new Error('parentUrl query parameter is required for live child scrape');
      err.statusCode = 400;
      err.code = 'PARENT_URL_REQUIRED';
      throw err;
    }

    const pageNum = Math.max(1, Number(page) || 1);
    const pid = String(parentId || '').trim() || shortHash(url, 12);
    const rel = this.liveRelPath('child', sec, pageNum, pid);
    const lockKey = `live:${rel}`;

    const cached = await this.readSsd(rel);
    if (cached) {
      return { ...cached, _meta: { cacheHit: true, source: 'ssd', relPath: rel } };
    }

    return this.lock.run(lockKey, async () => {
      const again = await this.readSsd(rel);
      if (again) {
        return { ...again, _meta: { cacheHit: true, source: 'ssd', relPath: rel } };
      }

      const siteId = this.siteForSection(sec);
      if (!siteId) {
        const err = new Error(`No site configured for ${sec}`);
        err.statusCode = 501;
        err.code = 'NO_SITE';
        throw err;
      }

      const started = Date.now();
      const result = await this.engine.scrapeChildren(siteId, sec, url, { page: pageNum });
      const items = this.processor.processItems(result.items || [], {
        section: `${sec}:children`,
        siteId,
      });
      result.items = null;

      const hasNext = items.length > 0;
      const doc = buildDocument({
        section: sec,
        page: pageNum,
        items,
        hasNext,
        extraMeta: {
          kind: 'children',
          source: 'live-scrape',
          siteId,
          parentId: pid,
          parentUrl: url,
          scrapeUrl: result.url || '',
        },
      });

      await this.writeSsd(rel, doc);
      logger.info('Live child scrape complete', {
        section: sec,
        parentId: pid,
        page: pageNum,
        items: items.length,
        hasNext,
        durationMs: Date.now() - started,
        ssd: rel,
      });

      return {
        ...doc,
        _meta: {
          cacheHit: false,
          source: 'live-scrape',
          durationMs: Date.now() - started,
          relPath: rel,
        },
      };
    });
  }
}

let singleton = null;

function getCatalogLiveScrapeService() {
  if (!singleton) {
    singleton = new CatalogLiveScrapeService();
  }
  return singleton;
}

module.exports = {
  CatalogLiveScrapeService,
  getCatalogLiveScrapeService,
};
