'use strict';

const { GitHubAuth } = require('./auth/GitHubAuth');
const { JsonComparer } = require('./compare/JsonComparer');
const { GitHubUploader } = require('./upload/GitHubUploader');
const { GitHubCommitter } = require('./commit/GitHubCommitter');
const { GitHubRollback } = require('./rollback/GitHubRollback');
const { GitHubVersion } = require('./version/GitHubVersion');
const { githubConfig } = require('../../config/github.config');
const { pipelineConfig } = require('../../config/pipeline.config');
const { githubLogger } = require('./logging/githubLogger');

/**
 * GitHub sync orchestrator — never imports scrapers.
 * Uploads only changed JSON files in a single commit when possible.
 */
class GitHubSyncService {
  /**
   * @param {object} [options]
   */
  constructor(options = {}) {
    this.config = options.config || githubConfig;
    this.auth = options.auth || new GitHubAuth(this.config);
    this.comparer = options.comparer || new JsonComparer();
    this.uploader = options.uploader || new GitHubUploader({ auth: this.auth, config: this.config });
    this.committer = options.committer || new GitHubCommitter({ uploader: this.uploader });
    this.rollback = options.rollback || new GitHubRollback({ uploader: this.uploader });
    this.version = options.version || new GitHubVersion(options);
    this.logger = options.logger || githubLogger;
  }

  get enabled() {
    return this.auth.enabled;
  }

  /**
   * Map local relative path to repo path.
   * @param {string} rel
   */
  toRepoPath(rel) {
    const clean = rel.replace(/^\/+/, '');
    if (!this.config.basePath) {
      return clean;
    }
    return `${this.config.basePath}/${clean}`;
  }

  /**
   * @param {Array<{ path: string, content: object }>} changedFiles
   * @param {object} [meta]
   */
  async uploadChangedFiles(changedFiles, meta = {}) {
    if (!this.enabled) {
      this.logger.warn('GitHub sync skipped — not configured');
      return {
        uploaded: false,
        reason: 'not_configured',
        filesUploaded: 0,
        commitSha: null,
      };
    }

    if (!changedFiles.length) {
      this.logger.info('GitHub sync skipped — no changed files');
      return {
        uploaded: false,
        reason: 'unchanged',
        filesUploaded: 0,
        commitSha: null,
      };
    }

    const generatedAt = meta.generatedAt || new Date().toISOString();
    const versionMeta = {
      schemaVersion: pipelineConfig.schemaVersion,
      generatorVersion: pipelineConfig.generatorVersion,
      lastUpdate: new Date().toISOString(),
      generatedAt,
      sections: meta.sections || [],
      filesChanged: changedFiles.length,
      version: null,
      commitSha: null,
    };

    const files = [
      ...changedFiles.map((f) => ({
        path: this.toRepoPath(f.path),
        content: `${JSON.stringify(f.content, null, 2)}\n`,
      })),
      {
        path: this.toRepoPath('version.json'),
        content: `${JSON.stringify(versionMeta, null, 2)}\n`,
      },
    ];

    const message = `${this.config.commitMessagePrefix} ${new Date().toISOString()} (${changedFiles.length} files)`;

    let parentSha = null;
    let commitSha = null;

    try {
      const created = await this.committer.commitFiles(files, message);
      parentSha = created.parentSha;
      commitSha = created.commitSha;

      await this.committer.publish(commitSha);

      versionMeta.commitSha = commitSha;
      versionMeta.version = commitSha ? commitSha.slice(0, 12) : null;

      const versionInfo = await this.version.writeVersionFile({
        commitSha,
        filesUploaded: changedFiles.length,
        sections: meta.sections || [],
        generatedAt,
        version: versionMeta.version,
      });

      this.logger.info('GitHub upload complete', {
        filesUploaded: changedFiles.length,
        commitSha,
        paths: files.map((f) => f.path),
      });

      return {
        uploaded: true,
        reason: 'changed',
        filesUploaded: changedFiles.length,
        commitSha,
        parentSha,
        version: versionInfo.meta,
        failures: [],
      };
    } catch (error) {
      this.logger.error('GitHub upload failed', {
        message: error.message,
        code: error.code,
        files: files.length,
      });

      if (commitSha && parentSha) {
        try {
          await this.rollback.rollbackTo(parentSha);
        } catch (rollbackError) {
          this.logger.error('GitHub rollback failed', {
            message: rollbackError.message,
            parentSha,
          });
        }
      }

      return {
        uploaded: false,
        reason: 'upload_failed',
        filesUploaded: 0,
        commitSha: null,
        parentSha,
        failures: [{ message: error.message, code: error.code }],
      };
    }
  }
}

module.exports = { GitHubSyncService };
