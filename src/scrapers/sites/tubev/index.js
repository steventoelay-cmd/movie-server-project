'use strict';

const { SelectorSiteAdapter } = require('../../core/SiteAdapter');
const selectors = require('./selectors');

/**
 * Tubev website adapter.
 * Implements the shared SiteAdapter interface via SelectorSiteAdapter.
 */
function createTubevAdapter(options = {}) {
  return new SelectorSiteAdapter({
    siteId: selectors.siteId,
    sectionConfigs: selectors.sectionConfigs,
    childrenConfigs: selectors.childrenConfigs,
    detailConfig: selectors.detailConfig,
    streamConfig: selectors.streamConfig,
    detailHosts: selectors.detailHosts,
    childUrlPatterns: selectors.childUrlPatterns,
    headers: selectors.headers,
    ...options,
  });
}

module.exports = {
  siteId: selectors.siteId,
  createTubevAdapter,
  createAdapter: createTubevAdapter,
};
