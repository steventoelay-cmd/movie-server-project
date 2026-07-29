'use strict';

const { SECTIONS, isParentChildSection, isValidSection } = require('../../domain/constants/sections');
const { ScrapeError } = require('../../domain/errors/ScrapeError');
const { scraperLogger } = require('../../infrastructure/logging/logger');
const { PromiseLock } = require('../../infrastructure/concurrency/PromiseLock');
const { defaultRegistry } = require('./AdapterRegistry');

/**
 * Modular scraper engine — orchestrates adapters without site-specific logic.
 * Does NOT: GitHub, scheduler, API, detail, related, m3u8.
 */
class ScraperEngine {
  /**
   * @param {object} [options]
   * @param {import('./AdapterRegistry').AdapterRegistry} [options.registry]
   * @param {object} [options.logger]
   */
  constructor(options = {}) {
    this.registry = options.registry || defaultRegistry;
    this.logger = options.logger || scraperLogger;
    this.lock = new PromiseLock();
  }

  /**
   * @returns {string[]}
   */
  listSites() {
    return this.registry.list();
  }

  /**
   * Scrape Home section (flat video items).
   * @param {string} siteId
   * @param {object} [options]
   * @param {number} [options.page]
   */
  async scrapeHome(siteId, options = {}) {
    return this._scrapeList(siteId, SECTIONS.HOME, options);
  }

  /**
   * Flat Myanmar (or search) video list — same shape as Home.
   * @param {string} siteId
   * @param {object} [options]
   */
  async scrapeMyanmar(siteId, options = {}) {
    return this._scrapeList(siteId, SECTIONS.MYANMAR, options);
  }

  /**
   * Scrape parent list for Model / Channel / Tag.
   * @param {string} siteId
   * @param {'model'|'channel'|'tag'} section
   * @param {object} [options]
   */
  async scrapeParents(siteId, section, options = {}) {
    if (!isParentChildSection(section)) {
      throw new ScrapeError('Section does not use parent/child', {
        code: 'INVALID_SECTION',
        statusCode: 400,
        meta: { section },
      });
    }
    return this._scrapeList(siteId, section, options);
  }

  /**
   * Scrape child videos under a parent URL.
   * Metadata only — no detail, related, or stream.
   *
   * @param {string} siteId
   * @param {'model'|'channel'|'tag'} section
   * @param {string} parentUrl
   * @param {object} [options]
   * @param {number} [options.page]
   */
  async scrapeChildren(siteId, section, parentUrl, options = {}) {
    if (!isParentChildSection(section)) {
      throw new ScrapeError('Section does not use parent/child', {
        code: 'INVALID_SECTION',
        statusCode: 400,
        meta: { section },
      });
    }
    if (!parentUrl || typeof parentUrl !== 'string') {
      throw new ScrapeError('parentUrl is required', {
        code: 'INVALID_PARENT_URL',
        statusCode: 400,
      });
    }

    const adapter = this.registry.get(siteId);
    if (!adapter.supportsSection(section)) {
      throw new ScrapeError('Site does not support section', {
        code: 'SECTION_UNSUPPORTED',
        statusCode: 501,
        meta: { siteId, section },
      });
    }

    const page = options.page || 1;
    const url = adapter.buildChildrenUrl(section, parentUrl, page);
    const started = Date.now();

    try {
      const html = await adapter.fetchHtml(url, options);
      const items = adapter.parseChildren(html, url, section);
      const durationMs = Date.now() - started;

      this.logger.info('Children scrape complete', {
        siteId,
        section,
        parentUrl,
        url,
        page,
        totalItems: items.length,
        durationMs,
      });

      return {
        siteId,
        section,
        kind: 'children',
        parentUrl,
        page,
        url,
        items,
        totalItems: items.length,
        durationMs,
        error: null,
      };
    } catch (error) {
      const durationMs = Date.now() - started;
      // No further child pages (404 / missing page).
      const httpStatus = error.meta?.status;
      if (error.code === 'FETCH_FAILED' && httpStatus === 404) {
        this.logger.info('Children scrape empty (404)', {
          siteId,
          section,
          parentUrl,
          url,
          page,
          durationMs,
        });
        return {
          siteId,
          section,
          kind: 'children',
          parentUrl,
          page,
          url,
          items: [],
          totalItems: 0,
          durationMs,
          error: null,
        };
      }
      this.logger.error('Children scrape failed', {
        siteId,
        section,
        parentUrl,
        url,
        durationMs,
        message: error.message,
        code: error.code,
      });
      throw error;
    }
  }

  /**
   * Run the same section across all registered sites that support it.
   * One site failure does not stop others — partial results returned.
   *
   * @param {'home'|'model'|'channel'|'tag'} section
   * @param {object} [options]
   */
  async scrapeSectionAcrossSites(section, options = {}) {
    if (!isValidSection(section)) {
      throw new ScrapeError('Invalid section', {
        code: 'INVALID_SECTION',
        statusCode: 400,
        meta: { section },
      });
    }

    const adapters = this.registry.listForSection(section);
    const results = [];

    for (const adapter of adapters) {
      try {
        const result =
          section === SECTIONS.HOME
            ? await this.scrapeHome(adapter.siteId, options)
            : await this.scrapeParents(adapter.siteId, section, options);
        results.push(result);
      } catch (error) {
        this.logger.error('Site scrape failed; continuing', {
          siteId: adapter.siteId,
          section,
          message: error.message,
          code: error.code,
        });
        results.push({
          siteId: adapter.siteId,
          section,
          kind: section === SECTIONS.HOME ? 'home' : 'parents',
          page: options.page || 1,
          url: null,
          items: [],
          totalItems: 0,
          durationMs: 0,
          error: {
            message: error.message,
            code: error.code || 'SCRAPE_ERROR',
          },
        });
      }
    }

    return results;
  }

  /**
   * @param {string} siteId
   * @param {string} section
   * @param {object} options
   * @private
   */
  async _scrapeList(siteId, section, options = {}) {
    const adapter = this.registry.get(siteId);
    if (!adapter.supportsSection(section)) {
      throw new ScrapeError('Site does not support section', {
        code: 'SECTION_UNSUPPORTED',
        statusCode: 501,
        meta: { siteId, section },
      });
    }

    const page = options.page || 1;
    const url = adapter.buildSectionUrl(section, page);
    const started = Date.now();
    const kind = section === SECTIONS.HOME || section === SECTIONS.MYANMAR ? 'home' : 'parents';

    try {
      const html = await adapter.fetchHtml(url, options);
      const items = this._parseSection(adapter, section, html, url);
      const durationMs = Date.now() - started;

      this.logger.info('Section scrape complete', {
        siteId,
        section,
        page,
        url,
        totalItems: items.length,
        durationMs,
      });

      return {
        siteId,
        section,
        kind,
        page,
        url,
        items,
        totalItems: items.length,
        durationMs,
        error: null,
      };
    } catch (error) {
      const durationMs = Date.now() - started;
      this.logger.error('Section scrape failed', {
        siteId,
        section,
        page,
        url,
        durationMs,
        message: error.message,
        code: error.code,
      });
      throw error;
    }
  }

  /**
   * @param {import('./SiteAdapter').SiteAdapter} adapter
   * @param {string} section
   * @param {string} html
   * @param {string} url
   * @private
   */
  _parseSection(adapter, section, html, url) {
    switch (section) {
      case SECTIONS.HOME:
        return adapter.parseHome(html, url);
      case SECTIONS.MYANMAR:
        return adapter.parseMyanmar(html, url);
      case SECTIONS.MODEL:
        return adapter.parseModelParents(html, url);
      case SECTIONS.CHANNEL:
        return adapter.parseChannelParents(html, url);
      case SECTIONS.TAG:
        return adapter.parseTagParents(html, url);
      default:
        throw new ScrapeError('Invalid section', {
          code: 'INVALID_SECTION',
          statusCode: 400,
          meta: { section },
        });
    }
  }
}

module.exports = { ScraperEngine };
