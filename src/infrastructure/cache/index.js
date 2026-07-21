'use strict';

const { DetailCache } = require('./DetailCache');
const { StreamCache } = require('./StreamCache');

let sharedDetailCache = null;
let sharedStreamCache = null;

function getDetailCache() {
  if (!sharedDetailCache) {
    sharedDetailCache = new DetailCache();
  }
  return sharedDetailCache;
}

function getStreamCache() {
  if (!sharedStreamCache) {
    sharedStreamCache = new StreamCache();
  }
  return sharedStreamCache;
}

module.exports = {
  DetailCache,
  StreamCache,
  getDetailCache,
  getStreamCache,
  HtmlPageCache: require('./HtmlPageCache').HtmlPageCache,
  getHtmlPageCache: require('./HtmlPageCache').getHtmlPageCache,
};
