'use strict';

/**
 * Example selector file for a new site.
 * Copy to ../{siteId}/selectors.js and fill in real values.
 */

const { SECTIONS } = require('../../../domain/constants/sections');

module.exports = {
  siteId: 'example_site',
  headers: {},
  sectionConfigs: {
    [SECTIONS.HOME]: {
      baseUrl: 'https://example.com/videos',
      selectors: {
        item: '.video-item',
        title: '.title',
        image: 'img',
        url: 'a',
      },
      attributes: {
        title: 'text',
        image: 'attr:src',
        url: 'attr:href',
      },
      pagination: {
        type: 'query',
        pattern: '?page={page}',
        omitFirstPage: true,
        startPage: 1,
      },
    },
    // [SECTIONS.MODEL]: { ... },
    // [SECTIONS.CHANNEL]: { ... },
    // [SECTIONS.TAG]: { ... },
  },
  childrenConfigs: {
    // [SECTIONS.MODEL]: { selectors, attributes, pagination },
  },
};
