'use strict';

const { getCatalogLoadService } = require('../../application/catalog/catalogLoad.factory');

async function getCatalogPage(req, res, next) {
  try {
    const service = getCatalogLoadService();
    const section = req.params.section;
    const page = Number(req.params.page) || 1;
    const parentId = req.query.parentId || req.params.parentId;
    const parentIndex = req.query.parentIndex === '1' || req.query.parentIndex === 'true';

    const doc = await service.getPage({ section, page, parentId, parentIndex });
    // Strip internal ops metadata — Flutter contract matches GitHub JSON docs
    const { _meta, ...body } = doc;
    if (_meta?.cacheHit != null) {
      res.setHeader('X-Cache', _meta.cacheHit ? 'HIT' : 'MISS');
    }
    res.json(body);
  } catch (error) {
    next(error);
  }
}

module.exports = { getCatalogPage };
