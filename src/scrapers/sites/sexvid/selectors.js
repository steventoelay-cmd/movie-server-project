'use strict';

const { SECTIONS } = require('../../../domain/constants/sections');
const { env } = require('../../../config/env');

/**
 * Site-local selectors and URLs for sexvid (Model section).
 */
module.exports = {
  siteId: 'sexvid',
  headers: {},
  sectionConfigs: {
    [SECTIONS.MODEL]: {
      baseUrl: env.sites.sexvidModelUrl,
      selectors: {
        item: '.th_model',
        title: '.model-name, .name, h2',
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
  },
  childrenConfigs: {
    [SECTIONS.MODEL]: {
      selectors: {
        item: '.model-item, .pornstar-card, .profile-box, figure.drop-label_else, .th',
        title: '.model-name, .name, h2, a.i.tur, .title',
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
        childrenType: 'query',
        childrenPattern: '?page={page}',
      },
    },
  },
  detailHosts: ['sexvid.xxx'],
  detailConfig: {
    fields: {
      title: { selector: 'h1, .video-title, .title', attribute: 'text' },
      image: { selector: 'meta[property="og:image"], video[poster], .player img', attribute: 'attr:content' },
      description: { selector: 'meta[property="og:description"], .description, .video-description', attribute: 'text' },
      duration: { selector: '.duration, time', attribute: 'text' },
      releaseDate: { selector: '.date, time[datetime]', attribute: 'text' },
      category: { selector: '.category a, a.category', attribute: 'text' },
      tags: { item: '.tags a, a.tag', attribute: 'text' },
    },
    related: {
      selectors: {
        item: '.related .th, .related-videos .item, .th',
        title: '.title, a',
        image: 'img',
        url: 'a',
      },
      attributes: {
        title: 'text',
        image: 'attr:src',
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
          selector: 'video source[type="video/mp4"], video[src*=".mp4"]',
          attribute: 'attr:src',
        },
      },
      m3u8Patterns: [
        /"(https?:\/\/[^"\\]+\.m3u8[^"\\]*)"/i,
        /hlsUrl\s*[=:]\s*["']([^"']+\.m3u8[^"']*)["']/i,
      ],
      scriptM3u8Patterns: [
        /"(https?:\/\/[^"\\]+\.m3u8[^"\\]*)"/i,
        /m3u8\s*[=:]\s*["']([^"']+\.m3u8[^"']*)["']/i,
      ],
      followIframe: true,
      iframeSelector: 'iframe.player, iframe#player, iframe[src*="embed"]',
    },
  },
};
