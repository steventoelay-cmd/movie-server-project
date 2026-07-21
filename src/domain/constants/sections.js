'use strict';

/**
 * App section identifiers for the Flutter catalog.
 */
const SECTIONS = Object.freeze({
  HOME: 'home',
  MODEL: 'model',
  CHANNEL: 'channel',
  TAG: 'tag',
  /** Flat video list (e.g. Myanmar search) — same JSON shape as home */
  MYANMAR: 'myanmar',
});

const PARENT_CHILD_SECTIONS = Object.freeze([
  SECTIONS.MODEL,
  SECTIONS.CHANNEL,
  SECTIONS.TAG,
]);

/** Flat video lists (page-N.json only, no parent index) */
const FLAT_LIST_SECTIONS = Object.freeze([SECTIONS.HOME, SECTIONS.MYANMAR]);

/**
 * @param {string} section
 * @returns {boolean}
 */
function isParentChildSection(section) {
  return PARENT_CHILD_SECTIONS.includes(section);
}

/**
 * @param {string} section
 * @returns {boolean}
 */
function isFlatListSection(section) {
  return FLAT_LIST_SECTIONS.includes(section);
}

/**
 * @param {string} section
 * @returns {boolean}
 */
function isValidSection(section) {
  return Object.values(SECTIONS).includes(section);
}

module.exports = {
  SECTIONS,
  PARENT_CHILD_SECTIONS,
  FLAT_LIST_SECTIONS,
  isParentChildSection,
  isFlatListSection,
  isValidSection,
};
