'use strict';

const { SECTIONS } = require('../../../domain/constants/sections');
const { env } = require('../../../config/env');

/**
 * xvideos.com selector + URL config.
 * Update selectors here only when the site HTML changes.
 *
 * List URLs come from HOME_* / MODELS_* / TAGS_* / CHANNELS_* / MYANMAR_* env.
 */
const videoThumbSelectors = {
  item: 'div.thumb-block[id^="video-thumb-"]',
  title: 'div.title',
  image: 'div.thumb img',
  url: 'a.thumb-link',
};

const videoThumbAttributes = {
  title: 'text',
  image: 'attr:data-src',
  url: 'attr:href',
};

/** Path pages: /best/2026-05 → /best/2026-05/2 */
const pathPagination = {
  type: 'path',
  pattern: '/{page}',
  omitFirstPage: true,
  startPage: 1,
};

/** Search-style: /?k=myanmar → /?k=myanmar&p=1 (0-based p for page 2+) */
const searchPagination = {
  type: 'query',
  pattern: 'p={page}',
  omitFirstPage: true,
  startPage: 1,
  pageOffset: -1,
};

module.exports = {
  siteId: 'xvideos',
  headers: {
    Referer: env.sites.watchReferer,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
  },
  detailHosts: ['xvideos.com'],
  sectionConfigs: {
    [SECTIONS.HOME]: {
      baseUrl: env.sites.xvideosHomeUrl,
      selectors: videoThumbSelectors,
      attributes: {
        ...videoThumbAttributes,
        // fallback if data-src empty — parseList may only use one attr; engine uses attribute map
        image: 'attr:data-src',
      },
      pagination: pathPagination,
    },
    [SECTIONS.MYANMAR]: {
      baseUrl: env.sites.xvideosMyanmarUrl,
      selectors: videoThumbSelectors,
      attributes: videoThumbAttributes,
      pagination: searchPagination,
    },
    [SECTIONS.MODEL]: {
      baseUrl: env.sites.xvideosModelsUrl,
      selectors: {
        item: 'div.thumb-block, div[id^="profile_"]',
        title: 'p.profile-name a, .profile-name a, p.title a, a',
        image: 'img',
        url: 'p.profile-name a, .profile-name a, a',
      },
      attributes: {
        title: 'text',
        image: 'attr:data-src',
        url: 'attr:href',
      },
      pagination: pathPagination,
    },
    [SECTIONS.CHANNEL]: {
      baseUrl: env.sites.xvideosChannelsUrl,
      selectors: {
        item: 'div.thumb-block, div[id^="profile_"]',
        title: 'p.profile-name a, .profile-name a, p.title a, a',
        image: 'img',
        url: 'p.profile-name a, .profile-name a, a',
      },
      attributes: {
        title: 'text',
        image: 'attr:data-src',
        url: 'attr:href',
      },
      pagination: pathPagination,
    },
    [SECTIONS.TAG]: {
      baseUrl: env.sites.xvideosTagsUrl,
      selectors: {
        item: '#tags li, .tags-list li, ul.tags li, a.tag',
        title: 'a, b',
        image: 'img',
        url: 'a',
      },
      attributes: {
        title: 'text',
        image: 'attr:src',
        url: 'attr:href',
      },
      pagination: pathPagination,
    },
  },
  childrenConfigs: {
    [SECTIONS.MODEL]: {
      selectors: videoThumbSelectors,
      attributes: videoThumbAttributes,
      pagination: {
        ...pathPagination,
        childrenType: 'path',
        childrenPattern: '/{page}',
      },
    },
    [SECTIONS.CHANNEL]: {
      selectors: videoThumbSelectors,
      attributes: videoThumbAttributes,
      pagination: {
        ...pathPagination,
        childrenType: 'path',
        childrenPattern: '/{page}',
      },
    },
    [SECTIONS.TAG]: {
      selectors: videoThumbSelectors,
      attributes: videoThumbAttributes,
      pagination: {
        ...pathPagination,
        childrenType: 'path',
        childrenPattern: '/{page}',
      },
    },
  },
  detailConfig: {
    fields: {
      title: { selector: 'h2.page-title, h1, #main h2', attribute: 'text' },
      image: {
        selector: 'meta[property="og:image"], #html5video img, video[poster]',
        attribute: 'attr:content',
      },
      description: {
        selector: 'meta[property="og:description"], #video-content-metadata',
        attribute: 'attr:content',
      },
      duration: { selector: 'span.duration, .duration', attribute: 'text' },
      releaseDate: { selector: '.video-metadata .date, span.video-date', attribute: 'text' },
      category: { selector: '#video-tags-list a.is-keyword, .video-metadata a', attribute: 'text' },
      tags: { item: '#video-tags-list a, a.is-keyword', attribute: 'text' },
    },
    related: {
      selectors: {
        item: 'div.thumb-block, div[id^="video_"]',
        title: 'p.title a, .title a',
        image: 'img',
        url: 'p.title a, .title a',
      },
      attributes: {
        title: 'text',
        image: 'attr:data-src',
        url: 'attr:href',
      },
    },
  },
  streamConfig: {
    videoExtraction: {
      selectors: {
        m3u8: {
          selector: 'source[type="application/x-mpegURL"], source[src*=".m3u8"], video[src*=".m3u8"]',
          attribute: 'attr:src',
        },
        mp4: {
          selector: 'video source[type="video/mp4"], video[src*=".mp4"], #html5video_base source',
          attribute: 'attr:src',
        },
      },
      m3u8Patterns: [
        /setVideoHLS\s*\(\s*['"]([^'"]+)['"]/i,
        /html5player\.setVideoHLS\s*\(\s*['"]([^'"]+)['"]/i,
        /"(https?:\/\/[^"\\]+\.m3u8[^"\\]*)"/i,
        /'(https?:\/\/[^'\\]+\.m3u8[^'\\]*)'/i,
      ],
      scriptM3u8Patterns: [
        /setVideoHLS\s*\(\s*['"]([^'"]+)['"]/i,
        /html5player\.setVideoHLS\s*\(\s*['"]([^'"]+)['"]/i,
        /"(https?:\/\/[^"\\]+\.m3u8[^"\\]*)"/i,
      ],
      mp4Patterns: [
        /setVideoUrlHigh\s*\(\s*['"]([^'"]+)['"]/i,
        /setVideoUrlLow\s*\(\s*['"]([^'"]+)['"]/i,
        /"(https?:\/\/[^"\\]+\.mp4[^"\\]*)"/i,
      ],
      scriptMp4Patterns: [
        /setVideoUrlHigh\s*\(\s*['"]([^'"]+)['"]/i,
        /setVideoUrlLow\s*\(\s*['"]([^'"]+)['"]/i,
      ],
      followIframe: true,
      iframeSelector: 'iframe.player, iframe#player, iframe[src*="embed"]',
    },
  },
};
