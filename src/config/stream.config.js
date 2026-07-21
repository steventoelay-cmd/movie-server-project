'use strict';

const { env } = require('./env');

const streamConfig = Object.freeze({
  timeoutMs: env.stream.timeoutMs,
  retries: env.stream.retries,
  retryBaseMs: env.stream.retryBaseMs,
  preferM3u8: env.stream.preferM3u8,
  allowStaleOnFailure: env.stream.allowStaleOnFailure,
  ttlMs: env.cache.streamTtlMs,
  graceMs: env.cache.streamGraceMs,
  inboundRateMax: env.stream.inboundRateMax,
  inboundRateWindowMs: env.stream.inboundRateWindowMs,
});

module.exports = { streamConfig };
