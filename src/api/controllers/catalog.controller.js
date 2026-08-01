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
 * Live scrape when:
 * - page >= LOADMORE_MIN_PAGE (default 4), or
 * - explicit live=1 (GET /loadmore always sets this) for any page.
 *
 * Myanmar / many model children only publish page-1 (or nothing) to GitHub;
 * Flutter then calls /loadmore?page=1|2 which must live-scrape.
 */
function wantsLiveScrape(req, page) {
  const minLive = catalogConfig.loadMoreMinPage || 4;
  const q = String(req.query.live || '').toLowerCase();
  const forceLive = q === '1' || q === 'true' || q === 'yes';
  if (forceLive) return true;
  return page >= minLive;
}

function isCatalogNotFound(error) {
  return (
    error &&
    (error.code === 'CATALOG_NOT_FOUND' ||
      error.code === 'NOT_FOUND' ||
      error.statusCode === 404)
  );
}

/**
 * When output/GitHub JSON is missing but we can scrape, do live scrape.
 * Covers model children under page-2+ parents that the pipeline never wrote.
 */
async function liveFallback(section, page, parentId, parentUrl) {
  const live = getCatalogLiveScrapeService();
  if (parentId && isParentChildSection(section) && parentUrl) {
    return live.scrapeChildPage(section, parentId, page, parentUrl);
  }
  if (!parentId && isFlatListSection(section)) {
    return live.scrapeFlatPage(section, page);
  }
  return null;
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
        try {
          doc = await getCatalogLoadService().getPage({
            section,
            page,
            parentId,
            parentIndex,
          });
        } catch (error) {
          const fallback = isCatalogNotFound(error)
            ? await liveFallback(section, page, parentId, parentUrl)
            : null;
          if (!fallback) throw error;
          doc = fallback;
        }
      }
    } else {
      // Prefer generated JSON; if missing and scrapeable, live-scrape.
      try {
        doc = await getCatalogLoadService().getPage({
          section,
          page,
          parentId,
          parentIndex,
        });
      } catch (error) {
        const fallback =
          !parentIndex && isCatalogNotFound(error)
            ? await liveFallback(section, page, parentId, parentUrl)
            : null;
        if (!fallback) throw error;
        doc = fallback;
      }
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
 * GET /loadmore?section=myanmar&page=2
 * GET /loadmore?section=model&parentId=...&parentUrl=...&page=1
 *
 * Always live-scrapes when possible (SSD cached 8h).
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

module.exports = { getCatalogPage, getLoadMore, wantsLiveScrape, liveFallback };
