'use strict';

const { githubConfig } = require('../../../config/github.config');

/**
 * GitHub authentication headers only — no scrape/upload logic.
 */
class GitHubAuth {
  /**
   * @param {object} [config]
   */
  constructor(config = githubConfig) {
    this.config = config;
  }

  get enabled() {
    return Boolean(this.config.token && this.config.owner && this.config.repo);
  }

  /**
   * @returns {object}
   */
  headers() {
    if (!this.config.token) {
      throw new Error('GITHUB_TOKEN is not configured');
    }
    return {
      Authorization: `Bearer ${this.config.token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'movies-server-project',
    };
  }

  repoApi(pathname = '') {
    const base = `https://api.github.com/repos/${this.config.owner}/${this.config.repo}`;
    return pathname ? `${base}${pathname.startsWith('/') ? '' : '/'}${pathname}` : base;
  }
}

module.exports = { GitHubAuth };
