'use strict';

const { getCatalogLoadService } = require('../../application/catalog/catalogLoad.factory');
const { getCatalogLiveScrapeService } = require('../../application/catalog/CatalogLiveScrapeService');
const { catalogConfig } = require('../../config/catalog.config');
const { isFlatListSection, isParentChildSection } = require('../../domain/constants/sections');

function normalizeSection(raw) {
  const s = String(raw || '').toLowerCase();
  if (s === 'models') return 'model';
  if (s === 'channels') return 'channel';
  if (s === 'tags') return 'tag';
  return s;
}

/**
 * GitHub holds pages 1–3. Live scrape + SSD only for page 4+.
 */
function wantsLiveScrape(req, page) {
  const minLive = catalogConfig.loadMoreMinPage || 4;
  const q = String(req.query.live || '').toLowerCase();
  const forceLive = q === '1' || q === 'true' || q === 'yes';
  if (forceLive && page >= minLive) return true;
  return page >= minLive;
}

async function getCatalogPage(req, res, next) {
  try {
    const section = normalizeSection(req.params.section || req.query.section);
    const page = Math.max(1, Number(req.params.page || req.query.page) || 1);
    const parentId = req.query.parentId || req.params.parentId;
    const parentIndex = req.query.parentIndex === '1' || req.query.parentIndex === 'true';
    const parentUrl = req.query.parentUrl ? String(req.query.parentUrl) : '';

    let doc;

    if (!parentIndex && wantsLiveScrape(req, page)) {
      const live = getCatalogLiveScrapeService();
      if (parentId && isParentChildSection(section)) {
        doc = await live.scrapeChildPage(section, parentId, page, parentUrl);
      } else if (isFlatListSection(section)) {
        doc = await live.scrapeFlatPage(section, page);
      } else {
        doc = await getCatalogLoadService().getPage({
          section,
          page,
          parentId,
          parentIndex,
        });
      }
    } else {
      // Pages 1–3: generated JSON from output/ (same files synced to GitHub)
      doc = await getCatalogLoadService().getPage({
        section,
        page,
        parentId,
        parentIndex,
      });
    }

    const { _meta, ...body } = doc;
    if (_meta?.cacheHit != null) {
      res.setHeader('X-Cache', _meta.cacheHit ? 'HIT' : 'MISS');
    }
    if (_meta?.source) {
      res.setHeader('X-Catalog-Source', String(_meta.source));
    }
    res.setHeader('Cache-Control', 'private, max-age=60');
    res.json(body);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /loadmore?section=home&page=4
 * GET /loadmore?section=model&parentId=...&parentUrl=...&page=4
 */
async function getLoadMore(req, res, next) {
  req.params = req.params || {};
  req.params.section = req.query.section;
  req.params.page = req.query.page;
  if (req.query.parentId) {
    req.params.parentId = req.query.parentId;
  }
  req.query.live = '1';
  return getCatalogPage(req, res, next);
}

module.exports = { getCatalogPage, getLoadMore };
