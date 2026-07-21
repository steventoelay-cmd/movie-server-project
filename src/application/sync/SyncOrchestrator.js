'use strict';

const path = require('path');
const { SECTIONS, isParentChildSection, isValidSection } = require('../../domain/constants/sections');
const { pipelineConfig, rootDir } = require('../../config/pipeline.config');
const { CatalogScrapeService } = require('../catalog/CatalogScrapeService');
const { CatalogProcessService } = require('../catalog/CatalogProcessService');
const { JsonGeneratorService } = require('../catalog/JsonGeneratorService');
const { CatalogDiffService } = require('../catalog/CatalogDiffService');
const { GitHubSyncService } = require('../../infrastructure/github');
const {
  acquireFileLock,
  replaceDir,
  ensureDir,
  readJsonFile,
} = require('../../utils/file.util');
const { createLogger } = require('../../infrastructure/logging/logger');
const { mapLimit } = require('../../utils/parallel.util');
const { performanceConfig } = require('../../config/performance.config');
const { getMetrics } = require('../../infrastructure/metrics/MetricsCollector');
const { PromiseLock } = require('../../infrastructure/concurrency/PromiseLock');

const logger = createLogger('pipeline');
const metrics = getMetrics();
const generateLock = new PromiseLock();

const ALL_SECTIONS = [
  SECTIONS.HOME,
  SECTIONS.MYANMAR,
  SECTIONS.MODEL,
  SECTIONS.CHANNEL,
  SECTIONS.TAG,
];

/**
 * Full catalog pipeline:
 * scrape → process → generate JSON → diff → GitHub upload (changed only) → promote previous/
 */
class SyncOrchestrator {
  /**
   * @param {object} [options]
   */
  constructor(options = {}) {
    this.scrapeService = options.scrapeService || new CatalogScrapeService();
    this.processService = options.processService || new CatalogProcessService();
    this.generator = options.generator || new JsonGeneratorService();
    this.diffService = options.diffService || new CatalogDiffService();
    this.github = options.github || new GitHubSyncService();
    this.lockPath =
      options.lockPath || path.join(rootDir, 'data', 'locks', 'pipeline.lock');
    this.upload = options.upload !== false;
  }

  /**
   * @param {string|string[]|'all'} sectionInput
   * @returns {string[]}
   */
  resolveSections(sectionInput = 'all') {
    if (!sectionInput || sectionInput === 'all') {
      return [...ALL_SECTIONS];
    }
    const list = Array.isArray(sectionInput) ? sectionInput : [sectionInput];
    const resolved = [];
    for (const raw of list) {
      const section = String(raw).toLowerCase();
      const normalized =
        section === 'models'
          ? SECTIONS.MODEL
          : section === 'channels'
            ? SECTIONS.CHANNEL
            : section === 'tags'
              ? SECTIONS.TAG
              : section;
      if (!isValidSection(normalized)) {
        throw Object.assign(new Error(`Invalid section: ${raw}`), { code: 'INVALID_SECTION' });
      }
      resolved.push(normalized);
    }
    return [...new Set(resolved)];
  }

  /**
   * Manual or scheduled entrypoint.
   * @param {object} [options]
   * @param {string|string[]} [options.sections]
   * @param {boolean} [options.upload]
   * @param {boolean} [options.skipLock]
   */
  async run(options = {}) {
    const started = Date.now();
    const sections = this.resolveSections(options.sections || 'all');
    const shouldUpload = options.upload ?? this.upload;
    let release = null;

    if (!options.skipLock) {
      release = await acquireFileLock(this.lockPath);
    }

    const report = {
      startedAt: new Date(started).toISOString(),
      sections,
      sectionResults: [],
      filesGenerated: [],
      filesChanged: [],
      filesUploaded: 0,
      upload: null,
      errors: [],
      durationMs: 0,
    };

    try {
      await ensureDir(pipelineConfig.outputDir);
      await ensureDir(pipelineConfig.previousDir);

      // Independent sections can run in parallel (bounded). Same-site still paced by RequestQueue.
      const sectionConcurrency = performanceConfig.sectionConcurrency;
      const sectionOutcomes = await mapLimit(sections, sectionConcurrency, async (section) => {
        const sectionStarted = Date.now();
        try {
          const result = await this.runSection(section);
          return {
            section,
            ok: true,
            ...result,
            durationMs: Date.now() - sectionStarted,
          };
        } catch (error) {
          logger.error('Section pipeline failed; continuing', {
            section,
            message: error.message,
            code: error.code,
          });
          return {
            section,
            ok: false,
            error: error.message,
            code: error.code,
            durationMs: Date.now() - sectionStarted,
            files: [],
          };
        }
      });

      for (const outcome of sectionOutcomes) {
        report.sectionResults.push(outcome);
        if (outcome.ok) {
          report.filesGenerated.push(...(outcome.files || []));
        } else {
          report.errors.push({
            section: outcome.section,
            message: outcome.error,
            code: outcome.code,
          });
        }
        metrics.timing(`pipeline.section.${outcome.section}`, outcome.durationMs);
      }

      // Diff only files belonging to sections we attempted (plus leftover tree)
      const diff = await this.diffService.diff();
      let changed = diff.changed;

      if (pipelineConfig.refuseEmptyOverwrite) {
        changed = await this.filterEmptyOverwrites(changed);
      }

      report.filesChanged = changed.map((c) => c.path);

      if (shouldUpload) {
        // Single-flight GitHub sync — never duplicate concurrent uploads
        const uploadStarted = Date.now();
        report.upload = await generateLock.run('github-upload', () =>
          this.github.uploadChangedFiles(changed, {
            sections,
            generatedAt: report.startedAt,
          }),
        );
        report.filesUploaded = report.upload.filesUploaded || 0;
        metrics.timing('github.upload', Date.now() - uploadStarted);

        if (report.upload.uploaded) {
          await replaceDir(pipelineConfig.outputDir, pipelineConfig.previousDir);
          logger.info('Promoted output/ to previous/ after successful upload');
        } else if (report.upload.reason === 'unchanged') {
          await replaceDir(pipelineConfig.outputDir, pipelineConfig.previousDir);
          logger.info('Promoted output/ to previous/ (unchanged remote)');
        } else if (report.upload.reason === 'not_configured') {
          await replaceDir(pipelineConfig.outputDir, pipelineConfig.previousDir);
          logger.warn('GitHub not configured — local previous/ updated only');
        } else {
          logger.warn('Skipped previous/ promotion due to upload failure', {
            reason: report.upload.reason,
          });
        }
      } else {
        await replaceDir(pipelineConfig.outputDir, pipelineConfig.previousDir);
        report.upload = { uploaded: false, reason: 'upload_disabled' };
        logger.info('Upload disabled — local previous/ updated');
      }

      report.durationMs = Date.now() - started;
      metrics.timing('pipeline.total', report.durationMs);
      metrics.incr('pipeline.runs');
      logger.info('Pipeline complete', {
        durationMs: report.durationMs,
        sections: sections.length,
        sectionConcurrency,
        filesGenerated: report.filesGenerated.length,
        filesChanged: report.filesChanged.length,
        filesUploaded: report.filesUploaded,
        errors: report.errors.length,
      });

      return report;
    } finally {
      if (release) {
        await release();
      }
    }
  }

  /**
   * @param {string} section
   * @private
   */
  async runSection(section) {
    const siteId = pipelineConfig.sectionSites[section];
    if (!siteId) {
      logger.warn('Skipping section — no site configured', { section });
      return {
        skipped: true,
        reason: 'no_site',
        files: [],
        totalItems: 0,
      };
    }

    if (section === SECTIONS.HOME) {
      const scraped = await this.scrapeService.scrapeHome();
      const generated = await this.generator.generateHome(scraped.items);
      return {
        skipped: false,
        siteId: scraped.siteId,
        files: generated.files,
        totalItems: generated.totalItems,
        pages: generated.pages,
      };
    }

    if (section === SECTIONS.MYANMAR) {
      const scraped = await this.scrapeService.scrapeMyanmar();
      const generated = await this.generator.generateMyanmar(scraped.items);
      return {
        skipped: false,
        siteId: scraped.siteId,
        files: generated.files,
        totalItems: generated.totalItems,
        pages: generated.pages,
      };
    }

    if (isParentChildSection(section)) {
      const scraped = await this.scrapeService.scrapeParentChild(section);
      const generated = await this.generator.generateParentChild(
        section,
        scraped.parents,
        scraped.childrenByParentId,
      );
      return {
        skipped: false,
        siteId: scraped.siteId,
        files: generated.files,
        totalItems: generated.totalItems,
        childTotal: generated.childTotal,
        pages: generated.pages,
      };
    }

    throw Object.assign(new Error(`Unsupported section ${section}`), { code: 'INVALID_SECTION' });
  }

  /**
   * Avoid wiping previously non-empty files with empty item lists.
   * @param {Array<{path:string, content:object}>} changed
   */
  async filterEmptyOverwrites(changed) {
    const filtered = [];
    for (const file of changed) {
      const nextItems = Array.isArray(file.content?.items) ? file.content.items : null;
      if (nextItems && nextItems.length === 0) {
        const prev = await readJsonFile(path.join(pipelineConfig.previousDir, file.path));
        const prevItems = Array.isArray(prev?.items) ? prev.items : [];
        if (prevItems.length > 0) {
          logger.warn('Refusing empty overwrite of previous JSON', { path: file.path });
          continue;
        }
      }
      filtered.push(file);
    }
    return filtered;
  }
}

module.exports = {
  SyncOrchestrator,
  ALL_SECTIONS,
};
