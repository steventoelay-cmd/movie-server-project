'use strict';

const axios = require('axios');
const { GitHubAuth } = require('../auth/GitHubAuth');
const { githubConfig } = require('../../../config/github.config');
const { withRetry, isRetryableError } = require('../../../utils/retry.util');
const { GitHubError } = require('../../../domain/errors/GitHubError');
const { githubLogger } = require('../logging/githubLogger');

/**
 * Low-level GitHub Git Data API helpers (blobs/trees/commits/refs).
 */
class GitHubUploader {
  /**
   * @param {object} [options]
   * @param {GitHubAuth} [options.auth]
   * @param {object} [options.config]
   */
  constructor(options = {}) {
    this.auth = options.auth || new GitHubAuth(options.config || githubConfig);
    this.config = options.config || githubConfig;
    this.logger = options.logger || githubLogger;
  }

  /**
   * @param {string} method
   * @param {string} url
   * @param {object} [data]
   */
  async request(method, url, data) {
    const execute = async () => {
      const response = await axios({
        method,
        url,
        data,
        headers: this.auth.headers(),
        timeout: 60000,
        validateStatus: () => true,
      });

      const remaining = response.headers?.['x-ratelimit-remaining'];
      if (remaining !== undefined) {
        this.logger.debug('GitHub rate limit', {
          remaining,
          reset: response.headers['x-ratelimit-reset'],
        });
      }

      if (response.status === 403 || response.status === 429) {
        const err = new GitHubError('GitHub rate limited or forbidden', {
          code: 'GITHUB_RATE_LIMIT',
          statusCode: response.status,
          retryable: true,
          meta: {
            message: response.data?.message,
            retryAfter: response.headers?.['retry-after'],
          },
        });
        throw err;
      }

      if (response.status >= 400) {
        throw new GitHubError(response.data?.message || 'GitHub API error', {
          code: 'GITHUB_API_ERROR',
          statusCode: response.status,
          retryable: response.status >= 500,
          meta: {
            // Never attach headers/token; only safe status fields
            status: response.status,
            documentation_url: response.data?.documentation_url,
          },
        });
      }

      return response.data;
    };

    return withRetry(execute, {
      retries: this.config.retries,
      baseMs: this.config.retryBaseMs,
      isRetryable: (error) => error.retryable === true || isRetryableError(error),
      onRetry: ({ attempt, waitMs, error }) => {
        this.logger.warn('Retrying GitHub API call', {
          attempt,
          waitMs,
          message: error.message,
          code: error.code,
        });
      },
    });
  }

  async getRefSha(branch = this.config.branch) {
    const data = await this.request('GET', this.auth.repoApi(`/git/ref/heads/${branch}`));
    return data.object.sha;
  }

  /**
   * @param {string} [branch]
   * @returns {Promise<string|null>}
   */
  async tryGetRefSha(branch = this.config.branch) {
    try {
      return await this.getRefSha(branch);
    } catch (error) {
      if (this.isEmptyRepoError(error)) {
        this.logger.info('GitHub branch missing or repo empty', {
          branch,
          message: error.message,
          statusCode: error.statusCode,
        });
        return null;
      }
      throw error;
    }
  }

  /**
   * @param {Error} error
   * @returns {boolean}
   */
  isEmptyRepoError(error) {
    const msg = String(error?.message || '');
    const status = error?.statusCode;
    return (
      status === 404 ||
      status === 409 ||
      /git repository is empty/i.test(msg) ||
      /not found/i.test(msg) ||
      /does not exist/i.test(msg)
    );
  }

  /**
   * Create the first commit on an empty repo via Contents API (reliable bootstrap).
   * After this, Git Data API refs exist and normal uploads work.
   * @param {string} [branch]
   * @returns {Promise<string>} branch tip SHA
   */
  async bootstrapEmptyRepository(branch = this.config.branch) {
    this.logger.info('Bootstrapping empty GitHub repository via Contents API', { branch });

    // For a completely empty repo, omit `branch` so GitHub creates the default branch.
    // Passing branch on an empty repo often returns "Git Repository is empty."
    await this.request('PUT', this.auth.repoApi('/contents/.gitkeep'), {
      message: 'chore: initialize catalog repository',
      content: Buffer.from('# catalog data\n').toString('base64'),
    });

    // Prefer configured branch; fall back to whatever tip GitHub created
    let sha = await this.tryGetRefSha(branch);
    if (!sha) {
      sha = await this.tryGetRefSha('main');
    }
    if (!sha) {
      sha = await this.tryGetRefSha('master');
    }
    if (!sha) {
      throw new GitHubError('Repository bootstrap succeeded but branch tip was not found', {
        code: 'GITHUB_BOOTSTRAP_FAILED',
        statusCode: 500,
        meta: { branch },
      });
    }

    this.logger.info('Empty repository initialized', { branch, sha });
    return sha;
  }

  /**
   * Ensure branch exists; bootstrap when repo has zero commits.
   * @param {string} [branch]
   * @returns {Promise<{ sha: string, bootstrapped: boolean }>}
   */
  async ensureBranchTip(branch = this.config.branch) {
    const existing = await this.tryGetRefSha(branch);
    if (existing) {
      return { sha: existing, bootstrapped: false };
    }
    const sha = await this.bootstrapEmptyRepository(branch);
    return { sha, bootstrapped: true };
  }

  async getCommit(sha) {
    return this.request('GET', this.auth.repoApi(`/git/commits/${sha}`));
  }

  async createBlob(content) {
    const data = await this.request('POST', this.auth.repoApi('/git/blobs'), {
      content: Buffer.from(content, 'utf8').toString('base64'),
      encoding: 'base64',
    });
    return data.sha;
  }

  /**
   * @param {string|null} baseTreeSha - null for empty repository (first commit)
   * @param {Array} entries
   */
  async createTree(baseTreeSha, entries) {
    const body = { tree: entries };
    if (baseTreeSha) {
      body.base_tree = baseTreeSha;
    }
    const data = await this.request('POST', this.auth.repoApi('/git/trees'), body);
    return data.sha;
  }

  async createCommit({ message, treeSha, parentSha }) {
    const body = {
      message,
      tree: treeSha,
      parents: parentSha ? [parentSha] : [],
    };
    const data = await this.request('POST', this.auth.repoApi('/git/commits'), body);
    return data.sha;
  }

  /**
   * Point branch at commit (creates ref when repo was empty).
   * @param {string} commitSha
   * @param {string} [branch]
   * @param {object} [options]
   * @param {boolean} [options.create] - POST new ref instead of PATCH
   */
  async updateRef(commitSha, branch = this.config.branch, options = {}) {
    if (options.create) {
      return this.request('POST', this.auth.repoApi('/git/refs'), {
        ref: `refs/heads/${branch}`,
        sha: commitSha,
      });
    }
    return this.request('PATCH', this.auth.repoApi(`/git/refs/heads/${branch}`), {
      sha: commitSha,
      force: false,
    });
  }

  /**
   * Force ref back to a previous commit SHA (rollback).
   * @param {string} commitSha
   * @param {string} [branch]
   */
  async resetRef(commitSha, branch = this.config.branch) {
    return this.request('PATCH', this.auth.repoApi(`/git/refs/heads/${branch}`), {
      sha: commitSha,
      force: true,
    });
  }
}

module.exports = { GitHubUploader };
