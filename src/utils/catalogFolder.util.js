'use strict';

const { SECTIONS } = require('../domain/constants/sections');

/** Flutter `CATALOG_BASE_URL` folder names → internal section keys */
const FOLDER_TO_SECTION = Object.freeze({
  home: SECTIONS.HOME,
  myanmar: SECTIONS.MYANMAR,
  models: SECTIONS.MODEL,
  channels: SECTIONS.CHANNEL,
  tags: SECTIONS.TAG,
  model: SECTIONS.MODEL,
  channel: SECTIONS.CHANNEL,
  tag: SECTIONS.TAG,
});

const PARENT_ID_RE = /^[a-z0-9][a-z0-9_-]{0,120}$/i;

/**
 * @param {string} folder - e.g. home, models, myanmar
 * @returns {string|null} section key or null
 */
function sectionFromFolder(folder) {
  return FOLDER_TO_SECTION[String(folder || '').toLowerCase()] || null;
}

/**
 * @param {string} parentId
 * @returns {boolean}
 */
function isValidParentId(parentId) {
  const id = String(parentId || '').trim();
  if (!id || id.includes('..') || id.includes('/') || id.includes('\\')) {
    return false;
  }
  return PARENT_ID_RE.test(id);
}

/**
 * @param {string|number} pageRaw
 * @returns {number|null}
 */
function parsePageNumber(pageRaw) {
  const page = Math.floor(Number(pageRaw));
  if (!Number.isFinite(page) || page < 1 || page > 100_000) {
    return null;
  }
  return page;
}

module.exports = {
  FOLDER_TO_SECTION,
  sectionFromFolder,
  isValidParentId,
  parsePageNumber,
};
