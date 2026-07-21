'use strict';

const { env } = require('./env');

const apiConfig = Object.freeze({
  port: env.api.port,
  host: env.api.host,
  corsOrigin: env.api.corsOrigin,
  apiKey: env.api.apiKey,
  allowedHosts: env.api.allowedHosts,
});

module.exports = { apiConfig };
