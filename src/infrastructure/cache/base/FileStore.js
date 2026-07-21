'use strict';

const path = require('path');
const { ensureDir, writeJsonFile, readJsonFile, listFilesRecursive } = require('../../../utils/file.util');
const fsp = require('fs/promises');

/**
 * Disk-backed cache store (L2). Redis-compatible surface: get/set/del/clear/stats.
 */
class FileStore {
  /**
   * @param {object} options
   * @param {string} options.dir
   */
  constructor(options) {
    this.dir = options.dir;
    this.stats = { hits: 0, misses: 0, sets: 0, deletes: 0 };
    this._ready = ensureDir(this.dir);
  }

  _pathFor(key) {
    const safe = String(key).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 180);
    return path.join(this.dir, `${safe}.json`);
  }

  async get(key) {
    await this._ready;
    const file = this._pathFor(key);
    const entry = await readJsonFile(file);
    if (!entry) {
      this.stats.misses += 1;
      return null;
    }
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      await this.del(key);
      this.stats.misses += 1;
      return null;
    }
    this.stats.hits += 1;
    return entry.value;
  }

  async set(key, value, ttlMs) {
    await this._ready;
    const entry = {
      value,
      createdAt: Date.now(),
      expiresAt: ttlMs > 0 ? Date.now() + ttlMs : 0,
    };
    await writeJsonFile(this._pathFor(key), entry);
    this.stats.sets += 1;
  }

  async del(key) {
    await this._ready;
    try {
      await fsp.unlink(this._pathFor(key));
      this.stats.deletes += 1;
      return true;
    } catch (error) {
      if (error.code === 'ENOENT') {
        return false;
      }
      throw error;
    }
  }

  async clear() {
    await this._ready;
    const files = await listFilesRecursive(this.dir);
    for (const rel of files) {
      await fsp.unlink(path.join(this.dir, rel));
    }
  }

  async cleanup() {
    await this._ready;
    const files = await listFilesRecursive(this.dir);
    let removed = 0;
    const now = Date.now();
    for (const rel of files) {
      const entry = await readJsonFile(path.join(this.dir, rel));
      if (!entry || (entry.expiresAt && now > entry.expiresAt)) {
        await fsp.unlink(path.join(this.dir, rel)).catch(() => {});
        removed += 1;
      }
    }
    return removed;
  }

  getStats() {
    return { ...this.stats };
  }
}

module.exports = { FileStore };
