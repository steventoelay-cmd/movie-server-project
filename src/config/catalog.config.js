'use strict';

const { boolEnv } = require('./env');
const { pipelineConfig } = require('./pipeline.config');
const { SECTIONS } = require('../domain/constants/sections');

/**
 * GitHub catalog layout and path resolution.
 *
 * legacy (default): models/index.json + models/{parentId}/page-N.json  (Flutter v1)
 * v2: model/page-N.json + model/child/{parentId}/page-N.json
 */
const catalogConfig = Object.freeze({
  layout: (process.env.CATALOG_LAYOUT || 'legacy').toLowerCase(),
  /** When layout=v2, also write legacy paths for existing clients */
  mirrorLegacyPaths: boolEnv('CATALOG_MIRROR_LEGACY', true),
  /** Scheduled pipeline section order (myanmar optional via env) */
  scheduledSectionOrder: (process.env.PIPELINE_SCHEDULED_SECTIONS || 'home,model,channel,tag')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean),
  /** Flutter Myanmar tab — include in cron pipeline after home by default */
  includeMyanmarInSchedule: boolEnv('PIPELINE_SCHEDULE_INCLUDE_MYANMAR', true),
  /** Serve Flutter GitHub-path catalog from output/ (GET /data/...) */
  cdnEnabled: boolEnv('CATALOG_CDN_ENABLED', true),
  cdnMountPath: (process.env.CATALOG_CDN_MOUNT_PATH || '/data').replace(/\/+$/, '') || '/data',
  /** SSD cache for catalog load-more API (page 4+) */
  ssdCacheDir: process.env.CATALOG_SSD_CACHE_DIR || 'data/cache/catalog',
  ssdCacheTtlMs: Number(process.env.CATALOG_SSD_CACHE_TTL_MS || 8 * 60 * 60 * 1000),
  /** Pages 1..N published to GitHub; N+1+ is live load-more */
  githubCdnPages: Number(process.env.GITHUB_CDN_PAGES || pipelineConfig.githubCdnPages || 3),
  loadMoreMinPage: Number(process.env.LOADMORE_MIN_PAGE || pipelineConfig.loadMoreMinPage || 4),
});

/**
 * hasNext for GitHub CDN pages: true on page 3 (when non-empty) so Flutter
 * continues with server load-more for page 4+.
 * @param {number} page - 1-based
 * @param {number} scrapedPageCount - how many non-empty scrape pages exist
 * @param {number} itemCount - items on this page
 */
function githubCdnHasNext(page, scrapedPageCount, itemCount) {
  if (!itemCount) return false;
  if (page < scrapedPageCount) return true;
  // Last scraped page within/at CDN window — more pages go through live API
  if (page >= catalogConfig.githubCdnPages) return true;
  return false;
}

const LEGACY_FOLDERS = Object.freeze({
  home: 'home',
  model: 'models',
  channel: 'channels',
  tag: 'tags',
  myanmar: 'myanmar',
});

const V2_FOLDERS = Object.freeze({
  home: 'home',
  model: 'model',
  channel: 'channel',
  tag: 'tag',
  myanmar: 'myanmar',
});

/**
 * @param {string} section
 * @param {'legacy'|'v2'} [layout]
 */
function sectionFolderName(section, layout = catalogConfig.layout) {
  const map = layout === 'v2' ? V2_FOLDERS : LEGACY_FOLDERS;
  return map[section] || pipelineConfig.sectionFolders[section] || section;
}

/**
 * Relative path under output/ or GitHub data prefix.
 * @param {object} q
 * @param {string} q.section
 * @param {number} q.page
 * @param {string} [q.parentId]
 * @param {'legacy'|'v2'} [q.layout]
 * @param {boolean} [q.parentIndex] - legacy index.json vs page-N for parent list
 */
function catalogPageRelPath(q) {
  const layout = q.layout || catalogConfig.layout;
  const folder = sectionFolderName(q.section, layout);
  const page = q.page || 1;

  if (q.parentId) {
    if (layout === 'v2') {
      return `${folder}/child/${q.parentId}/page-${page}.json`;
    }
    return `${folder}/${q.parentId}/page-${page}.json`;
  }

  if (q.parentIndex && layout === 'legacy') {
    return `${folder}/index.json`;
  }

  return `${folder}/page-${page}.json`;
}

/**
 * All relative paths to write for one parent-list or child page (legacy mirror).
 * @param {object} q
 * @returns {string[]}
 */
function catalogWritePaths(q) {
  const primary = catalogPageRelPath(q);
  const paths = [primary];

  if (catalogConfig.layout === 'v2' && catalogConfig.mirrorLegacyPaths) {
    if (q.parentId) {
      paths.push(catalogPageRelPath({ ...q, layout: 'legacy' }));
    } else if (q.parentIndex && q.page === 1) {
      paths.push(catalogPageRelPath({ ...q, layout: 'legacy', parentIndex: true }));
    } else if (!q.parentId && !q.parentIndex) {
      paths.push(catalogPageRelPath({ ...q, layout: 'legacy' }));
    } else if (q.parentIndex) {
      paths.push(catalogPageRelPath({ ...q, layout: 'legacy', parentIndex: true }));
      paths.push(catalogPageRelPath({ ...q, layout: 'legacy', page: q.page }));
    }
  }

  return [...new Set(paths)];
}

/**
 * Sections for cron / sequential pipeline.
 * @returns {string[]}
 */
function resolveScheduledSections() {
  const order = [...catalogConfig.scheduledSectionOrder];
  const out = [];
  for (const raw of order) {
    const section =
      raw === 'models'
        ? SECTIONS.MODEL
        : raw === 'channels'
          ? SECTIONS.CHANNEL
          : raw === 'tags'
            ? SECTIONS.TAG
            : raw;
    if (Object.values(SECTIONS).includes(section)) {
      out.push(section);
    }
  }
  if (catalogConfig.includeMyanmarInSchedule) {
    const homeIdx = out.indexOf(SECTIONS.HOME);
    if (homeIdx >= 0 && !out.includes(SECTIONS.MYANMAR)) {
      out.splice(homeIdx + 1, 0, SECTIONS.MYANMAR);
    } else if (!out.includes(SECTIONS.MYANMAR)) {
      out.unshift(SECTIONS.MYANMAR);
    }
  }
  return out.length ? out : [SECTIONS.HOME, SECTIONS.MODEL, SECTIONS.CHANNEL, SECTIONS.TAG];
}

module.exports = {
  catalogConfig,
  sectionFolderName,
  catalogPageRelPath,
  catalogWritePaths,
  resolveScheduledSections,
  githubCdnHasNext,
  LEGACY_FOLDERS,
  V2_FOLDERS,
};
