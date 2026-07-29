'use strict';

const path = require('path');
const fsp = require('fs/promises');
const { pipelineConfig } = require('../../config/pipeline.config');
const { catalogPageRelPath } = require('../../config/catalog.config');
const { SECTIONS, isValidSection } = require('../../domain/constants/sections');
const { getCatalogSsdCache } = require('../../infrastructure/cache/CatalogSsdCache');
const { readJsonFile } = require('../../utils/file.util');
const { createLogger } = require('../../infrastructure/logging/logger');

const logger = createLogger('catalog-load');

/**
 * Load-more catalog pages from server output/ with SSD cache (8h default).
 * Initial page-1 remains on GitHub CDN; Flutter calls this for page 2+.
 */
class CatalogLoadService {
  /**
   * @param {object} [options]
   */
  constructor(options = {}) {
    this.outputDir = options.outputDir || pipelineConfig.outputDir;
    this.cache = options.cache || getCatalogSsdCache();
  }

  /**
   * @param {object} q
   * @param {string} q.section - home|model|channel|tag|myanmar
   * @param {number} q.page
   * @param {string} [q.parentId]
   * @param {boolean} [q.parentIndex]
   */
  async getPage(q) {
    const section = this.normalizeSection(q.section);
    if (!isValidSection(section)) {
      const err = new Error(`Invalid section: ${q.section}`);
      err.statusCode = 400;
      err.code = 'INVALID_SECTION';
      throw err;
    }

    const page = Math.max(1, Number(q.page) || 1);
    const rel = catalogPageRelPath({
      section,
      page,
      parentId: q.parentId,
      parentIndex: q.parentIndex === true,
    });

    const cached = await this.cache.get(rel);
    if (cached.hit && cached.doc) {
      return { ...cached.doc, _meta: { cacheHit: true, source: 'ssd', relPath: rel } };
    }

    const doc = await this.readFromOutput(rel, section, page, q.parentId, q.parentIndex);
    if (!doc) {
      const err = new Error('Catalog page not found');
      err.statusCode = 404;
      err.code = 'CATALOG_NOT_FOUND';
      throw err;
    }

    await this.cache.set(rel, doc);
    return { ...doc, _meta: { cacheHit: false, source: 'output', relPath: rel } };
  }

  async readFromOutput(rel, section, page, parentId, parentIndex) {
    let doc = await readJsonFile(path.join(this.outputDir, rel));
    if (doc) {
      return doc;
    }

    const fallbacks = [];
    if (parentId) {
      fallbacks.push(
        catalogPageRelPath({ section, page, parentId, layout: 'legacy' }),
        catalogPageRelPath({ section, page, parentId, layout: 'v2' }),
      );
    } else if (parentIndex) {
      fallbacks.push(
        catalogPageRelPath({ section, page: 1, parentIndex: true, layout: 'legacy' }),
        catalogPageRelPath({ section, page, layout: 'v2' }),
      );
    } else {
      fallbacks.push(catalogPageRelPath({ section, page, layout: 'legacy' }));
    }

    for (const alt of fallbacks) {
      if (alt === rel) {
        continue;
      }
      doc = await readJsonFile(path.join(this.outputDir, alt));
      if (doc) {
        return doc;
      }
    }

    return null;
  }

  normalizeSection(raw) {
    const s = String(raw || '').toLowerCase();
    if (s === 'models') return SECTIONS.MODEL;
    if (s === 'channels') return SECTIONS.CHANNEL;
    if (s === 'tags') return SECTIONS.TAG;
    return s;
  }

  async warmFromOutput(relPath) {
    const full = path.join(this.outputDir, relPath);
    try {
      const raw = await fsp.readFile(full, 'utf8');
      const doc = JSON.parse(raw);
      await this.cache.set(relPath.replace(/\\/g, '/'), doc);
      return true;
    } catch {
      return false;
    }
  }
}

module.exports = { CatalogLoadService };
