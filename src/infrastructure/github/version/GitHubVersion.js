'use strict';

const path = require('path');
const { writeJsonFile, ensureDir } = require('../../../utils/file.util');
const { pipelineConfig } = require('../../../config/pipeline.config');
const { githubLogger } = require('../logging/githubLogger');

/**
 * Persist catalog version metadata after successful sync.
 */
class GitHubVersion {
  /**
   * @param {object} [options]
   * @param {string} [options.outputDir]
   */
  constructor(options = {}) {
    this.outputDir = options.outputDir || pipelineConfig.outputDir;
    this.logger = options.logger || githubLogger;
  }

  /**
   * @param {object} info
   */
  async writeVersionFile(info) {
    const meta = {
      schemaVersion: pipelineConfig.schemaVersion,
      generatorVersion: pipelineConfig.generatorVersion,
      lastUpdate: new Date().toISOString(),
      generatedAt: info.generatedAt || new Date().toISOString(),
      commitSha: info.commitSha || null,
      filesUploaded: info.filesUploaded || 0,
      sections: info.sections || [],
      version: info.version || null,
    };

    const rel = 'version.json';
    await ensureDir(this.outputDir);
    await writeJsonFile(path.join(this.outputDir, rel), meta);
    this.logger.info('Wrote version metadata', { path: rel, commitSha: meta.commitSha });
    return { path: rel, meta };
  }
}

module.exports = { GitHubVersion };
