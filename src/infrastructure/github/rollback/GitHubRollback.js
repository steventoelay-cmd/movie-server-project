'use strict';

const { GitHubUploader } = require('../upload/GitHubUploader');
const { githubLogger } = require('../logging/githubLogger');

/**
 * Rollback GitHub branch to a previous commit when publish fails mid-flight.
 */
class GitHubRollback {
  /**
   * @param {object} [options]
   * @param {GitHubUploader} [options.uploader]
   */
  constructor(options = {}) {
    this.uploader = options.uploader || new GitHubUploader(options);
    this.logger = options.logger || githubLogger;
  }

  /**
   * @param {string} previousSha
   * @returns {Promise<{ rolledBack: boolean, sha: string|null }>}
   */
  async rollbackTo(previousSha) {
    if (!previousSha) {
      return { rolledBack: false, sha: null };
    }
    await this.uploader.resetRef(previousSha);
    this.logger.warn('GitHub branch rolled back', { previousSha });
    return { rolledBack: true, sha: previousSha };
  }
}

module.exports = { GitHubRollback };
