'use strict';

const { SECTIONS } = require('../../../domain/constants/sections');
const { env } = require('../../../config/env');

/**
 * Site-local selectors and URLs for tubev.
 * Update selectors here only — do not touch engine or other adapters.
 */
module.exports = {
  siteId: 'tubev',
  headers: {},
  sectionConfigs: {
    [SECTIONS.HOME]: {
      baseUrl: env.sites.tubevHomeUrl,
      selectors: {
        item: 'figure.drop-label_else',
        title: 'a.i.tur',
        image: 'img',
        url: 'a',
      },
      attributes: {
        title: 'attr:title',
        image: 'attr:src',
        url: 'attr:href',
      },
      pagination: {
        type: 'query',
        pattern: '?p={page}',
        omitFirstPage: true,
        startPage: 1,
      },
    },
    [SECTIONS.CHANNEL]: {
      baseUrl: env.sites.tubevChannelUrl,
      selectors: {
        item: '#all_list figure',
        title: 'a.i',
        image: 'img',
        url: 'a.i',
      },
      attributes: {
        title: 'attr:title',
        image: 'attr:src',
        url: 'attr:href',
      },
      pagination: {
        type: 'query',
        pattern: '?p={page}',
        omitFirstPage: true,
        startPage: 1,
      },
    },
  },
  childrenConfigs: {
    [SECTIONS.CHANNEL]: {
      selectors: {
        item: 'figure.drop-label_else',
        title: 'div.drop',
        image: 'img',
        url: 'a.i.tur',
      },
      attributes: {
        title: 'text',
        image: 'attr:src',
        url: 'attr:href',
      },
      pagination: {
        type: 'query',
        pattern: '?p={page}',
        omitFirstPage: true,
        startPage: 1,
        childrenType: 'query',
        childrenPattern: '?p={page}',
      },
    },
  },
  detailHosts: ['tubev.sex'],
  detailConfig: {
    fields: {
      title: { selector: 'h1, .video-title, .title, a.i.tur', attribute: 'text' },
      image: { selector: 'meta[property="og:image"], video[poster], img.player-poster, .video-player img', attribute: 'attr:content' },
      description: { selector: 'meta[property="og:description"], .video-description, .description, #description', attribute: 'text' },
      duration: { selector: '.duration, time, .video-duration', attribute: 'text' },
      releaseDate: { selector: '.date, time[datetime], .upload-date', attribute: 'text' },
      category: { selector: '.category a, a.category', attribute: 'text' },
      tags: { item: '.tags a, .tag-list a, a.tag', attribute: 'text' },
    },
    related: {
      selectors: {
        item: '#related_video_block figure.drop-label_else, .related figure.drop-label_else, figure.drop-label_else',
        title: 'a.i.tur',
        image: 'img',
        url: 'a.i.tur',
      },
      attributes: {
        title: 'attr:title',
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
        /'(https?:\/\/[^'\\]+\.m3u8[^'\\]*)'/i,
        /hlsUrl\s*[=:]\s*["']([^"']+\.m3u8[^"']*)["']/i,
        /file\s*:\s*["']([^"']+\.m3u8[^"']*)["']/i,
      ],
      scriptM3u8Patterns: [
        /"(https?:\/\/[^"\\]+\.m3u8[^"\\]*)"/i,
        /m3u8\s*[=:]\s*["']([^"']+\.m3u8[^"']*)["']/i,
        /hls[_]?url\s*[=:]\s*["']([^"']+)["']/i,
      ],
      followIframe: true,
      iframeSelector: 'iframe.player, iframe#player, iframe[src*="embed"], iframe[src*="player"]',
    },
  },
};
