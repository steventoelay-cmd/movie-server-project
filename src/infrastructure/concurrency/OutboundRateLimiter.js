'use strict';

const { delay } = require('../../utils/delay.util');
const { scraperConfig } = require('../../config/scraper.config');

/**
 * Outbound request pacing + concurrency cap for website fetches.
 * Prevents excessive requests; ready for future per-host limits.
 */
class OutboundRateLimiter {
  /**
   * @param {object} [options]
   * @param {number} [options.intervalMs]
   * @param {number} [options.maxConcurrency]
   */
  constructor(options = {}) {
    this.intervalMs = options.intervalMs ?? scraperConfig.requestIntervalMs;
    this.maxConcurrency = options.maxConcurrency ?? scraperConfig.maxConcurrency;
    this._active = 0;
    this._queue = [];
    this._lastStartAt = 0;
  }

  /**
   * @template T
   * @param {() => Promise<T>} fn
   * @returns {Promise<T>}
   */
  schedule(fn) {
    return new Promise((resolve, reject) => {
      this._queue.push({ fn, resolve, reject });
      this._pump();
    });
  }

  async _pump() {
    if (this._active >= this.maxConcurrency) {
      return;
    }
    const next = this._queue.shift();
    if (!next) {
      return;
    }

    this._active += 1;
    try {
      const elapsed = Date.now() - this._lastStartAt;
      if (this._lastStartAt && elapsed < this.intervalMs) {
        await delay(this.intervalMs - elapsed);
      }
      this._lastStartAt = Date.now();
      const result = await next.fn();
      next.resolve(result);
    } catch (error) {
      next.reject(error);
    } finally {
      this._active -= 1;
      this._pump();
    }
  }

  stats() {
    return {
      active: this._active,
      queued: this._queue.length,
      intervalMs: this.intervalMs,
      maxConcurrency: this.maxConcurrency,
    };
  }
}

module.exports = { OutboundRateLimiter };
