'use strict';

const { intEnv, boolEnv, listEnv, env } = require('./env');

/**
 * Security configuration — all secrets from env, never hardcoded.
 */
const securityConfig = Object.freeze({
  nodeEnv: env.nodeEnv,
  isProduction: env.nodeEnv === 'production',

  /** Fail closed on Detail/Stream when true */
  requireApiKey: boolEnv('REQUIRE_API_KEY', env.nodeEnv === 'production'),

  /** Admin/scheduler trigger key (future JWT/OAuth can sit beside this) */
  adminApiKey: process.env.ADMIN_API_KEY || '',
  requireAdminKey: boolEnv('REQUIRE_ADMIN_KEY', false),

  cors: Object.freeze({
    /** Comma-separated origins; empty or * = reflect request in non-strict mode */
    origins: listEnv('CORS_ORIGIN').length
      ? listEnv('CORS_ORIGIN')
      : env.api.corsOrigin === '*'
        ? ['*']
        : String(env.api.corsOrigin || '*')
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
    methods: listEnv('CORS_METHODS').length
      ? listEnv('CORS_METHODS')
      : ['GET', 'HEAD', 'OPTIONS'],
    allowedHeaders: listEnv('CORS_HEADERS').length
      ? listEnv('CORS_HEADERS')
      : ['Content-Type', 'X-Api-Key', 'X-Request-Id', 'Authorization'],
    /** In production, reject * unless explicitly allowed */
    allowWildcardInProduction: boolEnv('CORS_ALLOW_WILDCARD_IN_PRODUCTION', false),
    maxAgeSec: intEnv('CORS_MAX_AGE_SEC', 600),
  }),

  rateLimit: Object.freeze({
    detailMax: intEnv('RATE_LIMIT_DETAIL_MAX', 120),
    detailWindowMs: intEnv('RATE_LIMIT_DETAIL_WINDOW_MS', 60 * 1000),
    streamMax: intEnv('RATE_LIMIT_STREAM_MAX', 60),
    streamWindowMs: intEnv('RATE_LIMIT_STREAM_WINDOW_MS', 60 * 1000),
    healthMax: intEnv('RATE_LIMIT_HEALTH_MAX', 300),
    healthWindowMs: intEnv('RATE_LIMIT_HEALTH_WINDOW_MS', 60 * 1000),
    adminMax: intEnv('RATE_LIMIT_ADMIN_MAX', 10),
    adminWindowMs: intEnv('RATE_LIMIT_ADMIN_WINDOW_MS', 60 * 1000),
  }),

  request: Object.freeze({
    jsonLimit: process.env.REQUEST_JSON_LIMIT || '100kb',
    urlMaxLength: intEnv('REQUEST_URL_MAX_LENGTH', 2048),
    timeoutMs: intEnv('REQUEST_TIMEOUT_MS_HTTP', 30000),
  }),

  /** Expose detailed metrics on /health only when true */
  healthExposeMetrics: boolEnv('HEALTH_EXPOSE_METRICS', env.nodeEnv !== 'production'),

  ssrf: Object.freeze({
    blockPrivateIps: boolEnv('SSRF_BLOCK_PRIVATE_IPS', true),
    blockLocalhost: boolEnv('SSRF_BLOCK_LOCALHOST', true),
  }),
});

module.exports = { securityConfig };
