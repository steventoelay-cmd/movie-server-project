'use strict';

const { SelectorSiteAdapter } = require('../../core/SiteAdapter');
const selectors = require('./selectors');

/**
 * Sexvid website adapter (Model parents / children).
 */
function createSexvidAdapter(options = {}) {
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
  createSexvidAdapter,
  createAdapter: createSexvidAdapter,
};
