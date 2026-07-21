'use strict';

const { delay } = require('../../utils/delay.util');
const { scraperConfig } = require('../../config/scraper.config');
const { getMetrics } = require('../metrics/MetricsCollector');

/**
 * Priority-aware outbound request queue.
 * Compatible with future distributed queues (same schedule(fn, opts) surface).
 *
 * Priority: lower number = higher priority (0 = highest).
 */
class RequestQueue {
  /**
   * @param {object} [options]
   */
  constructor(options = {}) {
    this.intervalMs = options.intervalMs ?? scraperConfig.requestIntervalMs;
    this.maxConcurrency = options.maxConcurrency ?? scraperConfig.maxConcurrency;
    this._active = 0;
    /** @type {Array<{ priority: number, enqueuedAt: number, fn: Function, resolve: Function, reject: Function, retries: number, delayMs: number }>} */
    this._queue = [];
    this._lastStartAt = 0;
    this.metrics = options.metrics || getMetrics();
    this._closed = false;
  }

  /**
   * @template T
   * @param {() => Promise<T>} fn
   * @param {object} [opts]
   * @param {number} [opts.priority=50]
   * @param {number} [opts.delayMs=0]
   * @returns {Promise<T>}
   */
  schedule(fn, opts = {}) {
    if (this._closed) {
      return Promise.reject(new Error('RequestQueue is closed'));
    }
    const priority = opts.priority ?? 50;
    const delayMs = opts.delayMs || 0;

    return new Promise((resolve, reject) => {
      this._queue.push({
        priority,
        enqueuedAt: Date.now(),
        fn,
        resolve,
        reject,
        retries: opts.retries || 0,
        delayMs,
      });
      this._queue.sort((a, b) => a.priority - b.priority || a.enqueuedAt - b.enqueuedAt);
      this.metrics.incr('request_queue.enqueued');
      this._pump();
    });
  }

  async _pump() {
    if (this._closed || this._active >= this.maxConcurrency) {
      return;
    }
    const next = this._queue.shift();
    if (!next) {
      return;
    }

    this._active += 1;
    this.metrics.incr('request_queue.started');

    try {
      if (next.delayMs > 0) {
        await delay(next.delayMs);
      }
      const elapsed = Date.now() - this._lastStartAt;
      if (this._lastStartAt && elapsed < this.intervalMs) {
        await delay(this.intervalMs - elapsed);
      }
      this._lastStartAt = Date.now();
      const result = await next.fn();
      next.resolve(result);
      this.metrics.incr('request_queue.completed');
    } catch (error) {
      if (next.retries > 0) {
        next.retries -= 1;
        next.priority = Math.min(next.priority + 1, 100);
        next.enqueuedAt = Date.now();
        this._queue.push(next);
        this._queue.sort((a, b) => a.priority - b.priority || a.enqueuedAt - b.enqueuedAt);
        this.metrics.incr('request_queue.requeued');
      } else {
        next.reject(error);
        this.metrics.incr('request_queue.failed');
      }
    } finally {
      this._active -= 1;
      this._pump();
    }
  }

  /**
   * Drain and reject pending work (graceful shutdown).
   */
  close() {
    this._closed = true;
    const pending = this._queue.splice(0);
    for (const item of pending) {
      item.reject(new Error('RequestQueue closed'));
    }
  }

  stats() {
    return {
      active: this._active,
      queued: this._queue.length,
      intervalMs: this.intervalMs,
      maxConcurrency: this.maxConcurrency,
      closed: this._closed,
    };
  }
}

module.exports = { RequestQueue };
