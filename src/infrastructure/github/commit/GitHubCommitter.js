'use strict';

const { GitHubUploader } = require('../upload/GitHubUploader');
const { githubLogger } = require('../logging/githubLogger');

/**
 * Commit orchestration helpers.
 * Empty repos are initialized via Contents API, then files are committed normally.
 */
class GitHubCommitter {
  /**
   * @param {object} [options]
   * @param {GitHubUploader} [options.uploader]
   */
  constructor(options = {}) {
    this.uploader = options.uploader || new GitHubUploader(options);
    this.logger = options.logger || githubLogger;
  }

  /**
   * Create one commit containing many file updates.
   * @param {Array<{ path: string, content: string }>} files
   * @param {string} message
   * @returns {Promise<{ commitSha: string, parentSha: string|null, emptyRepo: boolean }>}
   */
  async commitFiles(files, message) {
    if (!files.length) {
      return { commitSha: null, parentSha: null, skipped: true, emptyRepo: false };
    }

    // Empty repo: Contents API creates first commit + branch, then we use Git Data API
    const tip = await this.uploader.ensureBranchTip();
    const parentSha = tip.sha;
    const emptyRepo = tip.bootstrapped;

    const parentCommit = await this.uploader.getCommit(parentSha);
    const baseTreeSha = parentCommit.tree.sha;

    const treeEntries = [];
    for (const file of files) {
      const blobSha = await this.uploader.createBlob(file.content);
      treeEntries.push({
        path: file.path,
        mode: '100644',
        type: 'blob',
        sha: blobSha,
      });
    }

    const treeSha = await this.uploader.createTree(baseTreeSha, treeEntries);
    const commitSha = await this.uploader.createCommit({
      message,
      treeSha,
      parentSha,
    });

    this.logger.info('GitHub commit created', {
      commitSha,
      parentSha,
      bootstrapped: emptyRepo,
      files: files.length,
    });

    return { commitSha, parentSha, skipped: false, emptyRepo };
  }

  /**
   * Point branch at commit.
   * @param {string} commitSha
   */
  async publish(commitSha) {
    await this.uploader.updateRef(commitSha);
    this.logger.info('GitHub ref updated', { commitSha });
    return commitSha;
  }
}

module.exports = { GitHubCommitter };
