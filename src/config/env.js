'use strict';

require('dotenv').config();

const { joinSiteUrl } = require('../utils/siteUrl.util');

/**
 * Load and normalize environment configuration.
 */
function intEnv(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') {
    return fallback;
  }
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : fallback;
}

function listEnv(name) {
  const raw = process.env[name];
  if (!raw || !String(raw).trim()) {
    return [];
  }
  return String(raw)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function boolEnv(name, fallback = false) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') {
    return fallback;
  }
  return ['1', 'true', 'yes', 'on'].includes(String(raw).toLowerCase());
}

const xvideosHomeUrl = joinSiteUrl(
  process.env.HOME_BASE_URL || 'https://www.xvideos.com',
  process.env.HOME_LIST_PATH || '/best/2026-05',
);
const xvideosModelsUrl = joinSiteUrl(
  process.env.MODELS_BASE_URL || 'https://www.xvideos.com',
  process.env.MODELS_LIST_PATH || '/pornstars-index',
);
const xvideosTagsUrl = joinSiteUrl(
  process.env.TAGS_BASE_URL || 'https://www.xvideos.com',
  process.env.TAGS_LIST_PATH || '/tags',
);
const xvideosChannelsUrl = joinSiteUrl(
  process.env.CHANNELS_BASE_URL || 'https://www.xvideos.com',
  process.env.CHANNELS_LIST_PATH || '/channels-index',
);
const xvideosMyanmarUrl = joinSiteUrl(
  process.env.MYANMAR_BASE_URL || 'https://www.xvideos.com',
  process.env.MYANMAR_LIST_PATH || '/?k=myanmar',
);

const env = Object.freeze({
  nodeEnv: process.env.NODE_ENV || 'development',
  logLevel: process.env.LOG_LEVEL || 'info',
  requestTimeoutMs: intEnv('REQUEST_TIMEOUT_MS', 15000),
  requestRetries: intEnv('REQUEST_RETRIES', 3),
  requestRetryBaseMs: intEnv('REQUEST_RETRY_BASE_MS', 1000),
  requestIntervalMs: intEnv('REQUEST_INTERVAL_MS', 300),
  requestMaxConcurrency: intEnv('REQUEST_MAX_CONCURRENCY', 4),
  userAgent:
    process.env.USER_AGENT ||
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  userAgentPool: listEnv('USER_AGENT_POOL'),
  sites: Object.freeze({
    // Legacy adapters (still registered)
    tubevHomeUrl: process.env.TUBEV_HOME_URL || 'https://www.tubev.sex/videos',
    tubevChannelUrl: process.env.TUBEV_CHANNEL_URL || 'https://www.tubev.sex/channels',
    sexvidModelUrl: process.env.SEXVID_MODEL_URL || 'https://www.sexvid.xxx/pornstars/',
    // Primary xvideos catalog URLs
    xvideosHomeUrl,
    xvideosModelsUrl,
    xvideosTagsUrl,
    xvideosChannelsUrl,
    xvideosMyanmarUrl,
    watchBaseUrl: process.env.WATCH_BASE_URL || 'https://www.xvideos.com',
    watchReferer: process.env.WATCH_REFERER || 'https://www.xvideos.com/',
  }),
  sections: Object.freeze({
    homeSite: process.env.SECTION_HOME_SITE || 'xvideos',
    modelSite: process.env.SECTION_MODEL_SITE || 'xvideos',
    channelSite: process.env.SECTION_CHANNEL_SITE || 'xvideos',
    tagSite: process.env.SECTION_TAG_SITE || 'xvideos',
    myanmarSite: process.env.SECTION_MYANMAR_SITE || 'xvideos',
  }),
  pipeline: Object.freeze({
    pageSize: intEnv('JSON_PAGE_SIZE', 100),
    maxHomePages: intEnv('PIPELINE_MAX_HOME_PAGES', 3),
    maxMyanmarPages: intEnv('PIPELINE_MAX_MYANMAR_PAGES', intEnv('PIPELINE_MAX_HOME_PAGES', 3)),
    maxParentPages: intEnv('PIPELINE_MAX_PARENT_PAGES', 3),
    maxChildPages: intEnv('PIPELINE_MAX_CHILD_PAGES', 2),
    maxParentsPerRun: intEnv('PIPELINE_MAX_PARENTS_PER_RUN', 30),
    outputDir: process.env.OUTPUT_DIR || 'output',
    previousDir: process.env.PREVIOUS_DIR || 'data/previous',
    refuseEmptyOverwrite: boolEnv('PIPELINE_REFUSE_EMPTY_OVERWRITE', true),
    schemaVersion: intEnv('JSON_SCHEMA_VERSION', 1),
    generatorVersion: process.env.GENERATOR_VERSION || '1.0.0',
  }),
  scheduler: Object.freeze({
    enabled: boolEnv('SCHEDULER_ENABLED', true),
    cron: process.env.SCHEDULER_CRON || '0 */8 * * *',
    timezone: process.env.SCHEDULER_TZ || 'UTC',
  }),
  github: Object.freeze({
    token: process.env.GITHUB_TOKEN || '',
    owner: process.env.GITHUB_OWNER || '',
    repo: process.env.GITHUB_REPO || '',
    branch: process.env.GITHUB_BRANCH || 'main',
    basePath: process.env.GITHUB_BASE_PATH || '',
    commitMessagePrefix: process.env.GITHUB_COMMIT_PREFIX || 'chore(catalog): sync',
    retries: intEnv('GITHUB_RETRIES', 3),
    retryBaseMs: intEnv('GITHUB_RETRY_BASE_MS', 1500),
  }),
  cache: Object.freeze({
    detailTtlMs: intEnv('DETAIL_CACHE_TTL_MS', 30 * 60 * 1000),
    relatedTtlMs: intEnv('RELATED_CACHE_TTL_MS', 8 * 60 * 60 * 1000),
    streamTtlMs: intEnv('STREAM_CACHE_TTL_MS', 4 * 60 * 1000),
    streamGraceMs: intEnv('STREAM_CACHE_GRACE_MS', 60 * 1000),
    streamRamOnly: boolEnv('STREAM_CACHE_RAM_ONLY', true),
    detailDir: process.env.DETAIL_CACHE_DIR || 'data/cache/detail',
    streamDir: process.env.STREAM_CACHE_DIR || 'data/cache/stream',
    catalogDir: process.env.CATALOG_SSD_CACHE_DIR || 'data/cache/catalog',
    relatedDir: process.env.RELATED_SSD_CACHE_DIR || 'data/cache/related',
    maxMemoryEntries: intEnv('DETAIL_CACHE_MAX_ENTRIES', 2000),
    streamMaxMemoryEntries: intEnv('STREAM_CACHE_MAX_ENTRIES', 5000),
  }),
  stream: Object.freeze({
    timeoutMs: intEnv('STREAM_TIMEOUT_MS', intEnv('REQUEST_TIMEOUT_MS', 15000)),
    retries: intEnv('STREAM_RETRIES', 2),
    retryBaseMs: intEnv('STREAM_RETRY_BASE_MS', 800),
    preferM3u8: boolEnv('STREAM_PREFER_M3U8', true),
    allowStaleOnFailure: boolEnv('STREAM_ALLOW_STALE_ON_FAILURE', true),
    inboundRateMax: intEnv('STREAM_RATE_LIMIT_MAX', 60),
    inboundRateWindowMs: intEnv('STREAM_RATE_LIMIT_WINDOW_MS', 60 * 1000),
  }),
  api: Object.freeze({
    port: intEnv('PORT', 3000),
    host: process.env.HOST || '0.0.0.0',
    corsOrigin: process.env.CORS_ORIGIN || '*',
    apiKey: process.env.API_KEY || '',
    allowedHosts: listEnv('DETAIL_ALLOWED_HOSTS').length
      ? listEnv('DETAIL_ALLOWED_HOSTS')
      : ['xvideos.com'],
  }),
});

module.exports = { env, intEnv, listEnv, boolEnv, joinSiteUrl };
