'use strict';

const { getMemoryStats } = require('../../utils/memory.util');

/**
 * Lightweight in-process metrics (Redis/Prometheus-compatible later).
 * Does not change API response contracts — exposed via /health additive fields.
 */
class MetricsCollector {
  constructor() {
    this.startedAt = Date.now();
    /** @type {Record<string, number>} */
    this.counters = Object.create(null);
    /** @type {Record<string, { count: number, totalMs: number, maxMs: number }>} */
    this.timings = Object.create(null);
    this._apiDurations = [];
    this._apiDurationsMax = 500;
  }

  incr(name, by = 1) {
    this.counters[name] = (this.counters[name] || 0) + by;
  }

  /**
   * @param {string} name
   * @param {number} durationMs
   */
  timing(name, durationMs) {
    const t = this.timings[name] || { count: 0, totalMs: 0, maxMs: 0 };
    t.count += 1;
    t.totalMs += durationMs;
    t.maxMs = Math.max(t.maxMs, durationMs);
    this.timings[name] = t;
  }

  /**
   * @param {number} durationMs
   */
  recordApiDuration(durationMs) {
    this._apiDurations.push(durationMs);
    if (this._apiDurations.length > this._apiDurationsMax) {
      this._apiDurations.shift();
    }
    this.timing('api.response', durationMs);
  }

  /**
   * @template T
   * @param {string} name
   * @param {() => Promise<T>} fn
   * @returns {Promise<T>}
   */
  async timeAsync(name, fn) {
    const started = Date.now();
    try {
      return await fn();
    } finally {
      this.timing(name, Date.now() - started);
    }
  }

  averageApiMs() {
    if (!this._apiDurations.length) {
      return 0;
    }
    const sum = this._apiDurations.reduce((a, b) => a + b, 0);
    return Math.round((sum / this._apiDurations.length) * 10) / 10;
  }

  snapshot(extra = {}) {
    const timings = {};
    for (const [k, v] of Object.entries(this.timings)) {
      timings[k] = {
        count: v.count,
        avgMs: v.count ? Math.round((v.totalMs / v.count) * 10) / 10 : 0,
        maxMs: v.maxMs,
      };
    }

    return {
      uptimeSec: Math.round((Date.now() - this.startedAt) / 1000),
      memory: getMemoryStats(),
      counters: { ...this.counters },
      timings,
      averageApiResponseMs: this.averageApiMs(),
      ...extra,
    };
  }
}

const sharedMetrics = new MetricsCollector();

function getMetrics() {
  return sharedMetrics;
}

module.exports = {
  MetricsCollector,
  getMetrics,
};
