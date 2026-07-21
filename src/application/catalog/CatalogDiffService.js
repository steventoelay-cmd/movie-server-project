'use strict';

const path = require('path');
const { pipelineConfig } = require('../../config/pipeline.config');
const { hasContentChanged } = require('../../utils/jsonCompare.util');
const { listFilesRecursive, readJsonFile } = require('../../utils/file.util');
const { createLogger } = require('../../infrastructure/logging/logger');

const logger = createLogger('catalog-diff');

/**
 * Compare generated output against previous snapshot.
 * Upload candidates = content-changed files only.
 */
class CatalogDiffService {
  /**
   * @param {object} [options]
   * @param {string} [options.outputDir]
   * @param {string} [options.previousDir]
   */
  constructor(options = {}) {
    this.outputDir = options.outputDir || pipelineConfig.outputDir;
    this.previousDir = options.previousDir || pipelineConfig.previousDir;
  }

  /**
   * @param {string[]} [limitToFiles] - optional relative paths to check
   * @returns {Promise<{ changed: Array<{path:string, content:object}>, unchanged: string[], added: string[], removed: string[] }>}
   */
  async diff(limitToFiles = null) {
    const generated = limitToFiles || (await listFilesRecursive(this.outputDir));
    const previousAll = await listFilesRecursive(this.previousDir);
    const previousSet = new Set(previousAll);
    const generatedSet = new Set(generated);

    const changed = [];
    const unchanged = [];
    const added = [];

    for (const rel of generated) {
      if (!rel.endsWith('.json')) {
        continue;
      }
      const next = await readJsonFile(path.join(this.outputDir, rel));
      const prev = await readJsonFile(path.join(this.previousDir, rel));

      if (!prev) {
        added.push(rel);
        changed.push({ path: rel, content: next });
        continue;
      }

      if (hasContentChanged(prev, next)) {
        changed.push({ path: rel, content: next });
      } else {
        unchanged.push(rel);
      }
    }

    const removed = previousAll.filter((p) => p.endsWith('.json') && !generatedSet.has(p));

    logger.info('Catalog diff complete', {
      generated: generated.filter((f) => f.endsWith('.json')).length,
      changed: changed.length,
      unchanged: unchanged.length,
      added: added.length,
      removed: removed.length,
      previousTotal: previousSet.size,
    });

    return { changed, unchanged, added, removed };
  }
}

module.exports = { CatalogDiffService };
