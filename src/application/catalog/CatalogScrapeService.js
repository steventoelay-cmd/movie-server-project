'use strict';

const { SECTIONS } = require('../../domain/constants/sections');
const { pipelineConfig } = require('../../config/pipeline.config');
const { createScraperEngine } = require('../../scrapers');
const { CatalogProcessService } = require('./CatalogProcessService');
const { parentIdFromItem } = require('../../utils/parentId.util');
const { createLogger } = require('../../infrastructure/logging/logger');
const { mapLimit } = require('../../utils/parallel.util');
const { performanceConfig } = require('../../config/performance.config');
const { getMetrics } = require('../../infrastructure/metrics/MetricsCollector');

const logger = createLogger('catalog-scrape');
const metrics = getMetrics();

/**
 * Multi-page catalog scraping for the pipeline (no detail/stream).
 */
class CatalogScrapeService {
  /**
   * @param {object} [options]
   * @param {import('../../scrapers/core/ScraperEngine').ScraperEngine} [options.engine]
   * @param {CatalogProcessService} [options.processor]
   */
  constructor(options = {}) {
    this.engine = options.engine || createScraperEngine();
    this.processor = options.processor || new CatalogProcessService();
  }

  siteForSection(section) {
    return pipelineConfig.sectionSites[section] || '';
  }

  /**
   * @param {string} section
   * @param {number} maxPages
   * @param {Function} scrapePageFn
   */
  async scrapePaged(section, maxPages, scrapePageFn) {
    const batches = [];
    const pageReports = [];

    for (let page = 1; page <= maxPages; page++) {
      try {
        const result = await scrapePageFn(page);
        batches.push(result.items || []);
        pageReports.push({
          page,
          url: result.url,
          totalItems: result.totalItems,
          durationMs: result.durationMs,
        });
        if (!result.items || result.items.length === 0) {
          break;
        }
      } catch (error) {
        logger.warn('Page scrape failed; stopping further pages for section', {
          section,
          page,
          message: error.message,
          code: error.code,
        });
        pageReports.push({ page, error: error.message });
        break;
      }
    }

    return { batches, pageReports };
  }

  /**
   * @returns {Promise<{ items: Array, siteId: string, pageReports: Array }>}
   */
  async scrapeHome() {
    const siteId = this.siteForSection(SECTIONS.HOME);
    if (!siteId) {
      throw Object.assign(new Error('No site configured for home'), { code: 'NO_SITE' });
    }

    const { batches, pageReports } = await this.scrapePaged(
      SECTIONS.HOME,
      pipelineConfig.maxHomePages,
      (page) => this.engine.scrapeHome(siteId, { page }),
    );

    const items = this.processor.processBatches(batches, {
      section: SECTIONS.HOME,
      siteId,
    });

    return { items, siteId, pageReports };
  }

  /**
   * Flat Myanmar search list (same item shape as Home).
   * @returns {Promise<{ items: Array, siteId: string, pageReports: Array }>}
   */
  async scrapeMyanmar() {
    const siteId = this.siteForSection(SECTIONS.MYANMAR);
    if (!siteId) {
      throw Object.assign(new Error('No site configured for myanmar'), { code: 'NO_SITE' });
    }

    const { batches, pageReports } = await this.scrapePaged(
      SECTIONS.MYANMAR,
      pipelineConfig.maxMyanmarPages,
      (page) => this.engine.scrapeMyanmar(siteId, { page }),
    );

    const items = this.processor.processBatches(batches, {
      section: SECTIONS.MYANMAR,
      siteId,
    });

    return { items, siteId, pageReports };
  }

  /**
   * Scrape parents + children for model/channel/tag.
   * @param {'model'|'channel'|'tag'} section
   */
  async scrapeParentChild(section) {
    const siteId = this.siteForSection(section);
    if (!siteId) {
      throw Object.assign(new Error(`No site configured for ${section}`), { code: 'NO_SITE' });
    }

    const { batches, pageReports } = await this.scrapePaged(
      section,
      pipelineConfig.maxParentPages,
      (page) => this.engine.scrapeParents(siteId, section, { page }),
    );

    let parents = this.processor.processBatches(batches, { section, siteId });
    if (pipelineConfig.maxParentsPerRun > 0) {
      parents = parents.slice(0, pipelineConfig.maxParentsPerRun);
    }

    parents = parents.map((p) => ({ ...p, id: parentIdFromItem(p) }));

    /** @type {Map<string, Array>} */
    const childrenByParentId = new Map();
    const childReports = [];
    const parentConcurrency = performanceConfig.parentConcurrency;

    await mapLimit(parents, parentConcurrency, async (parent) => {
      const childBatches = [];
      for (let page = 1; page <= pipelineConfig.maxChildPages; page++) {
        try {
          const result = await this.engine.scrapeChildren(siteId, section, parent.url, { page });
          childBatches.push(result.items || []);
          childReports.push({
            parentId: parent.id,
            page,
            totalItems: result.totalItems,
            durationMs: result.durationMs,
          });
          if (!result.items || result.items.length === 0) {
            break;
          }
        } catch (error) {
          logger.warn('Child scrape failed; continuing next parent', {
            section,
            parentId: parent.id,
            page,
            message: error.message,
          });
          childReports.push({ parentId: parent.id, page, error: error.message });
          break;
        }
      }

      const children = this.processor.processBatches(childBatches, {
        section: `${section}:children`,
        siteId,
      });
      childrenByParentId.set(parent.id, children);
    });

    metrics.incr('catalog.parents_scraped', parents.length);

    return {
      siteId,
      parents,
      childrenByParentId,
      pageReports,
      childReports,
    };
  }
}

module.exports = { CatalogScrapeService };
