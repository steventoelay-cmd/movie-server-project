'use strict';

const { env } = require('./env');

const githubConfig = Object.freeze({
  token: env.github.token,
  owner: env.github.owner,
  repo: env.github.repo,
  branch: env.github.branch,
  basePath: env.github.basePath.replace(/^\/+|\/+$/g, ''),
  commitMessagePrefix: env.github.commitMessagePrefix,
  retries: env.github.retries,
  retryBaseMs: env.github.retryBaseMs,
  enabled: Boolean(env.github.token && env.github.owner && env.github.repo),
});

module.exports = { githubConfig };
