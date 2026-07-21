'use strict';

const { ScrapeError } = require('../../domain/errors/ScrapeError');

/**
 * Registry of website adapters. New sites register here without touching others.
 */
class AdapterRegistry {
  constructor() {
    /** @type {Map<string, import('./SiteAdapter').SiteAdapter>} */
    this._adapters = new Map();
  }

  /**
   * @param {import('./SiteAdapter').SiteAdapter} adapter
   */
  register(adapter) {
    if (!adapter || !adapter.siteId) {
      throw new ScrapeError('Cannot register adapter without siteId', {
        code: 'REGISTRY_INVALID',
        statusCode: 500,
      });
    }
    this._adapters.set(adapter.siteId, adapter);
    return this;
  }

  /**
   * @param {string} siteId
   * @returns {import('./SiteAdapter').SiteAdapter}
   */
  get(siteId) {
    const adapter = this._adapters.get(siteId);
    if (!adapter) {
      throw new ScrapeError(`Unknown site adapter: ${siteId}`, {
        code: 'ADAPTER_NOT_FOUND',
        statusCode: 404,
        meta: { siteId, available: this.list() },
      });
    }
    return adapter;
  }

  /**
   * @param {string} siteId
   * @returns {boolean}
   */
  has(siteId) {
    return this._adapters.has(siteId);
  }

  /** @returns {string[]} */
  list() {
    return [...this._adapters.keys()];
  }

  /**
   * @param {string} section
   * @returns {import('./SiteAdapter').SiteAdapter[]}
   */
  listForSection(section) {
    return [...this._adapters.values()].filter((a) => a.supportsSection(section));
  }
}

const defaultRegistry = new AdapterRegistry();

module.exports = {
  AdapterRegistry,
  defaultRegistry,
};
