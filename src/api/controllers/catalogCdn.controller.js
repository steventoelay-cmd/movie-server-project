'use strict';

const path = require('path');
const { getCatalogLoadService } = require('../../application/catalog/catalogLoad.factory');
const { pipelineConfig } = require('../../config/pipeline.config');
const { readJsonFile } = require('../../utils/file.util');
const {
  sectionFromFolder,
  isValidParentId,
  parsePageNumber,
} = require('../../utils/catalogFolder.util');

function invalidFolderError(folder) {
  const err = new Error(`Unknown catalog folder: ${folder}`);
  err.statusCode = 400;
  err.code = 'INVALID_CATALOG_FOLDER';
  throw err;
}

async function sendCatalogDoc(req, res, next, loadQuery) {
  try {
    const service = getCatalogLoadService();
    const doc = await service.getPage(loadQuery);
    const { _meta, ...body } = doc;
    if (_meta?.cacheHit != null) {
      res.setHeader('X-Cache', _meta.cacheHit ? 'HIT' : 'MISS');
    }
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.json(body);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /data/:folder/index.json — parent index (models, channels, tags)
 */
async function getParentIndex(req, res, next) {
  try {
    const section = sectionFromFolder(req.params.folder);
    if (!section) {
      invalidFolderError(req.params.folder);
    }
    await sendCatalogDoc(req, res, next, {
      section,
      page: 1,
      parentIndex: true,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /data/:folder/page-:page.json — flat lists (home, myanmar)
 */
async function getFlatPage(req, res, next) {
  try {
    const section = sectionFromFolder(req.params.folder);
    if (!section) {
      invalidFolderError(req.params.folder);
    }
    const page = parsePageNumber(req.params.page);
    if (page == null) {
      const err = new Error('Invalid page number');
      err.statusCode = 400;
      err.code = 'INVALID_PAGE';
      throw err;
    }
    await sendCatalogDoc(req, res, next, { section, page });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /data/:folder/:parentId/page-:page.json — child videos under a parent
 */
async function getChildPage(req, res, next) {
  try {
    const section = sectionFromFolder(req.params.folder);
    if (!section) {
      invalidFolderError(req.params.folder);
    }
    const parentId = String(req.params.parentId || '').trim();
    if (!isValidParentId(parentId)) {
      const err = new Error('Invalid parent id');
      err.statusCode = 400;
      err.code = 'INVALID_PARENT_ID';
      throw err;
    }
    const page = parsePageNumber(req.params.page);
    if (page == null) {
      const err = new Error('Invalid page number');
      err.statusCode = 400;
      err.code = 'INVALID_PAGE';
      throw err;
    }
    await sendCatalogDoc(req, res, next, { section, page, parentId });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /data/version.json — optional sync metadata (same as GitHub repo root under data/)
 */
async function getVersionJson(req, res, next) {
  try {
    const doc = await readJsonFile(path.join(pipelineConfig.outputDir, 'version.json'));
    if (!doc) {
      const err = new Error('version.json not found');
      err.statusCode = 404;
      err.code = 'CATALOG_NOT_FOUND';
      throw err;
    }
    res.setHeader('Cache-Control', 'public, max-age=60');
    res.json(doc);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getParentIndex,
  getFlatPage,
  getChildPage,
  getVersionJson,
};
