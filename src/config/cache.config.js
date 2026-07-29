'use strict';

const path = require('path');
const { env } = require('./env');
const { rootDir } = require('./pipeline.config');

const cacheConfig = Object.freeze({
  detailTtlMs: env.cache.detailTtlMs,
  relatedTtlMs: env.cache.relatedTtlMs,
  streamTtlMs: env.cache.streamTtlMs,
  streamGraceMs: env.cache.streamGraceMs,
  streamRamOnly: env.cache.streamRamOnly,
  detailDir: path.resolve(rootDir, env.cache.detailDir),
  streamDir: path.resolve(rootDir, env.cache.streamDir),
  catalogDir: path.resolve(rootDir, env.cache.catalogDir),
  relatedDir: path.resolve(rootDir, env.cache.relatedDir),
  maxMemoryEntries: env.cache.maxMemoryEntries,
  streamMaxMemoryEntries: env.cache.streamMaxMemoryEntries,
});

module.exports = { cacheConfig };
