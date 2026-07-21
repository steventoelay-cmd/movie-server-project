'use strict';

const { GitHubUploader } = require('../upload/GitHubUploader');
const { githubLogger } = require('../logging/githubLogger');

/**
 * Commit orchestration helpers.
 * Supports empty repositories (first commit creates the branch).
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

    const parentSha = await this.uploader.tryGetRefSha();
    const emptyRepo = !parentSha;
    let baseTreeSha = null;

    if (parentSha) {
      const parentCommit = await this.uploader.getCommit(parentSha);
      baseTreeSha = parentCommit.tree.sha;
    } else {
      this.logger.info('GitHub repository is empty — creating initial commit');
    }

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
      emptyRepo,
      files: files.length,
    });

    return { commitSha, parentSha, skipped: false, emptyRepo };
  }

  /**
   * Point branch at commit (creates branch on empty repo).
   * @param {string} commitSha
   * @param {object} [options]
   * @param {boolean} [options.emptyRepo]
   */
  async publish(commitSha, options = {}) {
    await this.uploader.updateRef(commitSha, undefined, { create: Boolean(options.emptyRepo) });
    this.logger.info('GitHub ref updated', {
      commitSha,
      created: Boolean(options.emptyRepo),
    });
    return commitSha;
  }
}

module.exports = { GitHubCommitter };
