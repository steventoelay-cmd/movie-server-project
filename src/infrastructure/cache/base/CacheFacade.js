'use strict';

const { PromiseLock } = require('../../concurrency/PromiseLock');

/**
 * Cache facade over memory + optional file store with TTL, stats, single-flight getOrSet.
 */
class CacheFacade {
  /**
   * @param {object} options
   * @param {import('./MemoryStore').MemoryStore} options.memory
   * @param {import('./FileStore').FileStore} [options.file]
   * @param {number} options.ttlMs
   * @param {string} [options.namespace]
   */
  constructor(options) {
    this.memory = options.memory;
    this.file = options.file || null;
    this.ttlMs = options.ttlMs;
    this.namespace = options.namespace || 'cache';
    this.lock = new PromiseLock();
  }

  key(raw) {
    return `${this.namespace}:${raw}`;
  }

  /**
   * @param {string} rawKey
   */
  async get(rawKey) {
    const key = this.key(rawKey);
    const mem = this.memory.get(key);
    if (mem != null) {
      return { value: mem, source: 'memory' };
    }
    if (this.file) {
      const disk = await this.file.get(key);
      if (disk != null) {
        this.memory.set(key, disk, this.ttlMs);
        return { value: disk, source: 'file' };
      }
    }
    return { value: null, source: null };
  }

  /**
   * @param {string} rawKey
   * @param {*} value
   * @param {number} [ttlMs]
   */
  async set(rawKey, value, ttlMs = this.ttlMs) {
    const key = this.key(rawKey);
    this.memory.set(key, value, ttlMs);
    if (this.file) {
      await this.file.set(key, value, ttlMs);
    }
  }

  /**
   * @param {string} rawKey
   * @param {() => Promise<*>} loader
   */
  async getOrSet(rawKey, loader) {
    const existing = await this.get(rawKey);
    if (existing.value != null) {
      return { value: existing.value, cacheHit: true, source: existing.source };
    }

    return this.lock.run(this.key(rawKey), async () => {
      const again = await this.get(rawKey);
      if (again.value != null) {
        return { value: again.value, cacheHit: true, source: again.source };
      }
      const value = await loader();
      await this.set(rawKey, value);
      return { value, cacheHit: false, source: null };
    });
  }

  async cleanup() {
    const memRemoved = this.memory.cleanup();
    const fileRemoved = this.file ? await this.file.cleanup() : 0;
    return { memRemoved, fileRemoved };
  }

  getStats() {
    return {
      namespace: this.namespace,
      ttlMs: this.ttlMs,
      memory: this.memory.getStats(),
      file: this.file ? this.file.getStats() : null,
      inflight: this.lock.size(),
    };
  }
}

module.exports = { CacheFacade };
