'use strict';

const { ScraperEngine } = require('./core/ScraperEngine');
const { AdapterRegistry, defaultRegistry } = require('./core/AdapterRegistry');
const { SiteAdapter, SelectorSiteAdapter } = require('./core/SiteAdapter');
const { registerSites } = require('./registerSites');
const { SECTIONS } = require('../domain/constants/sections');

/**
 * Create a ready-to-use scraper engine with all built-in sites registered.
 * @param {object} [options]
 * @returns {ScraperEngine}
 */
function createScraperEngine(options = {}) {
  const registry = options.registry || defaultRegistry;
  registerSites(registry);
  return new ScraperEngine({
    registry,
    logger: options.logger,
  });
}

module.exports = {
  createScraperEngine,
  registerSites,
  ScraperEngine,
  AdapterRegistry,
  defaultRegistry,
  SiteAdapter,
  SelectorSiteAdapter,
  SECTIONS,
};
