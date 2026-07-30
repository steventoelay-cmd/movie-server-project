'use strict';

const { SelectorSiteAdapter } = require('../../core/SiteAdapter');
const selectors = require('./selectors');

/**
 * xvideos.com website adapter.
 */
function createXvideosAdapter(options = {}) {
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
  createXvideosAdapter,
  createAdapter: createXvideosAdapter,
};
