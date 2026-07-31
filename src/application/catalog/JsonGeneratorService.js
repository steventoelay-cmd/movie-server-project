'use strict';

const path = require('path');
const { pipelineConfig } = require('../../config/pipeline.config');
const { catalogConfig, catalogPageRelPath, catalogWritePaths } = require('../../config/catalog.config');
const { performanceConfig } = require('../../config/performance.config');
const { SECTIONS } = require('../../domain/constants/sections');
const { hashPayload, sanitizeForCompare, hasContentChanged } = require('../../utils/jsonCompare.util');
const {
  writeJsonFile,
  ensureDir,
  listFilesRecursive,
  removeDir,
  readJsonFile,
} = require('../../utils/file.util');
const fsp = require('fs/promises');
const { createLogger } = require('../../infrastructure/logging/logger');
const { getMetrics } = require('../../infrastructure/metrics/MetricsCollector');

const logger = createLogger('json-generator');
const metrics = getMetrics();

/**
 * Split items into page chunks.
 * @param {Array} items
 * @param {number} pageSize
 * @returns {Array<Array>}
 */
function chunkItems(items, pageSize) {
  const size = Math.max(1, pageSize);
  const pages = [];
  for (let i = 0; i < items.length; i += size) {
    pages.push(items.slice(i, i + size));
  }
  if (pages.length === 0) {
    pages.push([]);
  }
  return pages;
}

/**
 * Build versioned JSON document for Flutter CDN.
 * Extra future fields can be added under meta without breaking clients.
 */
function buildDocument({ section, page, items, extraMeta = {}, hasNext = false, itemsShape = 'default' }) {
  const { itemIdFromUrl } = require('../../utils/itemId.util');
  const generatedAt = new Date().toISOString();
  const stableItems = items.map((item) => {
    const id = item.id || itemIdFromUrl(item.url);
    if (itemsShape === 'titleUrl') {
      return { id, title: item.title, url: item.url };
    }
    return {
      id,
      title: item.title,
      img: item.img || '',
      url: item.url,
    };
  });

  const contentVersion = hashPayload(sanitizeForCompare({ items: stableItems })).slice(0, 16);

  return {
    schemaVersion: pipelineConfig.schemaVersion,
    generatorVersion: pipelineConfig.generatorVersion,
    section,
    page,
    totalItems: stableItems.length,
    hasNext: Boolean(hasNext),
    version: contentVersion,
    generatedAt,
    lastUpdate: generatedAt,
    meta: {
      compression: 'none',
      ...extraMeta,
    },
    items: stableItems,
  };
}

/**
 * JSON generator — writes GitHub-ready catalog files under output/.
 * Skips disk writes when content is unchanged (volatile timestamps ignored).
 */
class JsonGeneratorService {
  /**
   * @param {object} [options]
   * @param {string} [options.outputDir]
   * @param {number} [options.pageSize]
   */
  constructor(options = {}) {
    this.outputDir = options.outputDir || pipelineConfig.outputDir;
    this.pageSize = options.pageSize || pipelineConfig.pageSize;
    this.skipUnchanged = options.skipUnchanged ?? performanceConfig.skipUnchangedJsonWrites;
  }

  sectionFolder(section) {
    const { sectionFolderName } = require('../../config/catalog.config');
    return sectionFolderName(section);
  }

  /**
   * Write the same document to primary (+ optional legacy mirror) paths.
   * @param {string[]} relPaths
   * @param {object} doc
   */
  async writeDocPaths(relPaths, doc) {
    let written = false;
    const paths = [];
    for (const rel of relPaths) {
      const result = await this.writeDoc(rel, doc);
      paths.push(rel);
      if (result.written) {
        written = true;
      }
    }
    return { written, path: paths[0], paths };
  }

  /**
   * Clear one section folder before regeneration (legacy / force).
   * @param {string} section
   */
  async clearSection(section) {
    const folder = path.join(this.outputDir, this.sectionFolder(section));
    await removeDir(folder);
    await ensureDir(folder);
  }

  /**
   * Write JSON only when content changed — reduces disk IO.
   * @param {string} rel
   * @param {object} doc
   */
  async writeDoc(rel, doc) {
    const full = path.join(this.outputDir, rel);
    if (this.skipUnchanged) {
      const existing = await readJsonFile(full);
      if (existing && !hasContentChanged(existing, doc)) {
        metrics.incr('json.write.skipped');
        return { written: false, path: rel };
      }
    }
    await writeJsonFile(full, doc);
    metrics.incr('json.write.done');
    return { written: true, path: rel };
  }

  /**
   * Remove files under section folder that are not in keepSet.
   * @param {string} section
   * @param {Set<string>} keepSet - relative paths from outputDir
   */
  async pruneSection(section, keepSet) {
    const folderName = this.sectionFolder(section);
    const folder = path.join(this.outputDir, folderName);
    await ensureDir(folder);
    const existing = await listFilesRecursive(folder);
    let removed = 0;
    for (const relInside of existing) {
      const rel = `${folderName}/${relInside}`.replace(/\\/g, '/');
      if (!keepSet.has(rel)) {
        await fsp.unlink(path.join(this.outputDir, rel)).catch(() => {});
        removed += 1;
      }
    }
    if (removed) {
      metrics.incr('json.prune.removed', removed);
      logger.debug('Pruned obsolete section files', { section, removed });
    }
    return removed;
  }

  /**
   * Generate home/page-N.json files.
   * @param {Array<{title,img,url}>} items
   */
  async generateHome(items) {
    return this.generateFlatList(SECTIONS.HOME, items);
  }

  /**
   * Generate myanmar/page-N.json (same contract as home).
   * @param {Array<{title,img,url}>} items
   */
  async generateMyanmar(items) {
    return this.generateFlatList(SECTIONS.MYANMAR, items);
  }

  /**
   * Flat list sections: {folder}/page-N.json
   * @param {string} section
   * @param {Array<{title,img,url}>} items
   */
  async generateFlatList(section, items) {
    const folder = this.sectionFolder(section);
    await ensureDir(path.join(this.outputDir, folder));
    const pages = chunkItems(items, this.pageSize);
    const files = [];
    const keep = new Set();
    let written = 0;

    for (let i = 0; i < pages.length; i++) {
      const page = i + 1;
      const relPaths = catalogWritePaths({
        section,
        page,
        parentIndex: false,
      });
      const doc = buildDocument({
        section,
        page,
        items: pages[i],
        hasNext: i < pages.length - 1,
        extraMeta: { kind: 'list' },
      });
      const result = await this.writeDocPaths(relPaths, doc);
      if (result.written) {
        written += 1;
      }
      for (const rel of relPaths) {
        files.push(rel);
        keep.add(rel);
      }
    }

    await this.pruneSection(section, keep);

    logger.info('Generated flat list JSON', {
      section,
      folder,
      files: files.length,
      written,
      skipped: files.length - written,
      totalItems: items.length,
      pageSize: this.pageSize,
    });

    return { files, totalItems: items.length, pages: pages.length, written };
  }

  /**
   * One GitHub JSON file per scraped website page (page-1..N align with scrape pages).
   * @param {string} section
   * @param {Array<Array<{title,img,url}>>} pageItemLists
   */
  async generateFlatListFromBatches(section, pageItemLists) {
    const folder = this.sectionFolder(section);
    await ensureDir(path.join(this.outputDir, folder));
    const batches = pageItemLists || [];
    const files = [];
    const keep = new Set();
    let written = 0;
    let totalItems = 0;

    for (let i = 0; i < batches.length; i++) {
      const items = batches[i] || [];
      totalItems += items.length;
      const page = i + 1;
      const relPaths = catalogWritePaths({ section, page, parentIndex: false });
      const doc = buildDocument({
        section,
        page,
        items,
        hasNext: i < batches.length - 1 && (batches[i + 1]?.length || 0) > 0,
        extraMeta: { kind: 'list' },
      });
      const result = await this.writeDocPaths(relPaths, doc);
      if (result.written) {
        written += 1;
      }
      for (const rel of relPaths) {
        files.push(rel);
        keep.add(rel);
      }
    }

    await this.pruneSection(section, keep);

    logger.info('Generated flat list JSON (per scrape page)', {
      section,
      folder,
      files: files.length,
      written,
      totalItems,
      scrapePages: batches.length,
    });

    return { files, totalItems, pages: batches.length, written };
  }

  /**
   * Generate models|channels|tags tree.
   * @param {'model'|'channel'|'tag'} section
   * @param {Array<{title,img,url,id?:string}>} parents
   * @param {Map<string, Array<{title,img,url}>>|Object} childrenByParentId
   * @param {object} [options]
   * @param {Array<Array<object>>} [options.parentListPages]
   * @param {Map<string, Array<Array<object>>>} [options.childrenPagesByParentId]
   */
  async generateParentChild(section, parents, childrenByParentId, options = {}) {
    const folder = this.sectionFolder(section);
    await ensureDir(path.join(this.outputDir, folder));

    const files = [];
    const keep = new Set();
    let written = 0;
    let childTotal = 0;

    const parentItems = parents.map((p) =>
      section === SECTIONS.TAG
        ? { id: p.id, title: p.title, url: p.url }
        : { id: p.id, title: p.title, img: p.img, url: p.url },
    );
    const parentItemsShape = section === SECTIONS.TAG ? 'titleUrl' : 'default';
    const useV2ParentPages = catalogConfig.layout === 'v2';
    const parentPages = useV2ParentPages ? chunkItems(parentItems, this.pageSize) : [parentItems];

    for (let pi = 0; pi < parentPages.length; pi++) {
      const page = pi + 1;
      const doc = buildDocument({
        section,
        page,
        items: parentPages[pi],
        hasNext: useV2ParentPages ? pi < parentPages.length - 1 : false,
        itemsShape: parentItemsShape,
        extraMeta: { kind: useV2ParentPages ? 'parent-list' : 'index', parentCount: parents.length },
      });

      const relPaths = useV2ParentPages
        ? catalogWritePaths({ section, page, parentIndex: false })
        : catalogWritePaths({ section, page: 1, parentIndex: true });

      const indexResult = await this.writeDocPaths(
        pi === 0 && !useV2ParentPages ? relPaths : useV2ParentPages ? relPaths : [],
        doc,
      );
      if (!useV2ParentPages && pi === 0) {
        if (indexResult.written) {
          written += 1;
        }
        for (const rel of relPaths) {
          files.push(rel);
          keep.add(rel);
        }
      } else if (useV2ParentPages) {
        if (indexResult.written) {
          written += 1;
        }
        for (const rel of relPaths) {
          files.push(rel);
          keep.add(rel);
        }
      }
    }

    const parentListPages = options.parentListPages || [];
    for (let i = 0; i < parentListPages.length; i++) {
      const page = i + 1;
      const pageItems = parentListPages[i] || [];
      if (!pageItems.length) {
        continue;
      }
      const doc = buildDocument({
        section,
        page,
        items: pageItems,
        hasNext:
          i < parentListPages.length - 1 && (parentListPages[i + 1]?.length || 0) > 0,
        itemsShape: parentItemsShape,
        extraMeta: { kind: 'parent-list', parentCount: pageItems.length },
      });
      const relPaths = catalogWritePaths({ section, page, parentIndex: false });
      const result = await this.writeDocPaths(relPaths, doc);
      if (result.written) {
        written += 1;
      }
      for (const rel of relPaths) {
        files.push(rel);
        keep.add(rel);
      }
    }

    const childrenPagesByParentId = options.childrenPagesByParentId;

    for (const parent of parents) {
      const parentId = parent.id;
      const children = childrenByParentId.get
        ? childrenByParentId.get(parentId) || []
        : childrenByParentId[parentId] || [];
      childTotal += children.length;

      const perScrapePages = childrenPagesByParentId?.get
        ? childrenPagesByParentId.get(parentId)
        : null;

      if (perScrapePages && perScrapePages.length) {
        for (let i = 0; i < perScrapePages.length; i++) {
          const items = perScrapePages[i] || [];
          if (!items.length) {
            continue;
          }
          const page = i + 1;
          const relPaths = catalogWritePaths({ section, page, parentId });
          const doc = buildDocument({
            section,
            page,
            items,
            hasNext:
              i < perScrapePages.length - 1 && (perScrapePages[i + 1]?.length || 0) > 0,
            extraMeta: {
              kind: 'children',
              parentId,
              parentTitle: parent.title,
              parentUrl: parent.url,
            },
          });
          const result = await this.writeDocPaths(relPaths, doc);
          if (result.written) {
            written += 1;
          }
          for (const rel of relPaths) {
            files.push(rel);
            keep.add(rel);
          }
        }
        continue;
      }

      const pages = chunkItems(children, this.pageSize);

      for (let i = 0; i < pages.length; i++) {
        const page = i + 1;
        const relPaths = catalogWritePaths({ section, page, parentId });
        const doc = buildDocument({
          section,
          page,
          items: pages[i],
          hasNext: i < pages.length - 1,
          extraMeta: {
            kind: 'children',
            parentId,
            parentTitle: parent.title,
            parentUrl: parent.url,
          },
        });
        const result = await this.writeDocPaths(relPaths, doc);
        if (result.written) {
          written += 1;
        }
        for (const rel of relPaths) {
          files.push(rel);
          keep.add(rel);
        }
      }
    }

    await this.pruneSection(section, keep);

    logger.info('Generated parent/child JSON', {
      section,
      folder,
      parents: parents.length,
      childTotal,
      files: files.length,
      written,
      skipped: files.length - written,
      pageSize: this.pageSize,
    });

    return {
      files,
      totalItems: parents.length,
      childTotal,
      pages: files.length,
      written,
    };
  }

  /**
   * @returns {Promise<string[]>} relative paths under outputDir
   */
  async listGeneratedFiles() {
    return listFilesRecursive(this.outputDir);
  }
}

module.exports = {
  JsonGeneratorService,
  buildDocument,
  chunkItems,
};
