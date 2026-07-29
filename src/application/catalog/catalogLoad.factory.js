'use strict';

const { CatalogLoadService } = require('./CatalogLoadService');

let singleton = null;

function getCatalogLoadService() {
  if (!singleton) {
    singleton = new CatalogLoadService();
  }
  return singleton;
}

module.exports = { getCatalogLoadService, CatalogLoadService };
