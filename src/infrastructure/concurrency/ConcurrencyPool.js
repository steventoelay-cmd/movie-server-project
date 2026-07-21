'use strict';

/**
 * Bounded concurrency pool for independent async tasks.
 * Future: worker-thread offload can implement the same run(fn) surface.
 */
class ConcurrencyPool {
  /**
   * @param {number} [max=4]
   */
  constructor(max = 4) {
    this.max = Math.max(1, max);
    this._active = 0;
    this._queue = [];
  }

  /**
   * @template T
   * @param {() => Promise<T>} fn
   * @returns {Promise<T>}
   */
  run(fn) {
    return new Promise((resolve, reject) => {
      this._queue.push({ fn, resolve, reject });
      this._pump();
    });
  }

  _pump() {
    while (this._active < this.max && this._queue.length) {
      const next = this._queue.shift();
      this._active += 1;
      Promise.resolve()
        .then(() => next.fn())
        .then(next.resolve, next.reject)
        .finally(() => {
          this._active -= 1;
          this._pump();
        });
    }
  }

  stats() {
    return { active: this._active, queued: this._queue.length, max: this.max };
  }
}

module.exports = { ConcurrencyPool };
