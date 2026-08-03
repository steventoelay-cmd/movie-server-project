'use strict';

const { SECTIONS } = require('../../../domain/constants/sections');
const { env } = require('../../../config/env');

/**
 * xvideos.com selector + URL config.
 * Update selectors here only when the site HTML changes.
 *
 * List URLs come from HOME_* / MODELS_* / TAGS_* / CHANNELS_* / MYANMAR_* env.
 *
 * Home /best uses id="video-thumb-*"; search (?k=) uses id="video_*".
 */
const videoThumbSelectors = {
  item: 'div.thumb-block[id^="video-thumb-"], div.thumb-block[id^="video_"]',
  title: 'p.title a, div.title a, p.title, div.title',
  image: 'div.thumb img, img',
  url: 'p.title a, a.thumb-link, div.thumb > a, a[href*="/video"]',
};

const videoThumbAttributes = {
  title: 'text',
  image: 'attr:data-src',
  url: 'attr:href',
};

/** Pornstars / channels index cards (thumbs often only inside <script>). */
const profileIndexSelectors = {
  item: 'div.thumb-block[id^="profile_"], div[id^="profile_"]',
  title: 'p.profile-name a, span.profile-name, .profile-name a, .profile-name',
  image: 'div.thumb img, img',
  url: 'p.profile-name a, .profile-name a, div.thumb > a',
};

const profileIndexAttributes = {
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

/**
 * Channel index links to profile slugs (/javhd) which show related channels, not videos.
 * `/?u={slug}` returns the same generic list for every slug — ignore it.
 * Official channel videos: `/?k=channel:{slug}` with search-style `p=` pagination.
 * @param {string} parentUrl
 * @returns {string}
 */
function channelChildrenBaseUrl(parentUrl) {
  try {
    const u = new URL(parentUrl);
    const existingK = u.searchParams.get('k');
    if (existingK) {
      return parentUrl;
    }
    if (u.searchParams.has('u') || u.searchParams.get('type') === 'channel') {
      const slug = u.searchParams.get('u') || u.searchParams.get('p') || '';
      if (slug) {
        return `${u.origin}/?k=${encodeURIComponent(`channel:${slug}`)}`;
      }
    }
    const segment = u.pathname.replace(/^\/+|\/+$/g, '').split('/').filter(Boolean)[0];
    if (!segment) {
      return parentUrl;
    }
    const reserved = new Set(['tags', 'channels', 'amateurs', 'models', 'profiles', 'video']);
    if (reserved.has(segment.toLowerCase())) {
      return parentUrl;
    }
    return `${u.origin}/?k=${encodeURIComponent(`channel:${segment}`)}`;
  } catch {
    return parentUrl;
  }
}

module.exports = {
  siteId: 'xvideos',
  headers: {
    Referer: env.sites.watchReferer,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
  },
  detailHosts: ['xvideos.com'],
  // Watch pages only — reject /tags/, /pornstars-index, profiles, etc.
  childUrlPatterns: [
    /^\/video\.?[0-9a-z]+(?:\/|$)/i,
    /^\/embedframe\//i,
  ],
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
      selectors: profileIndexSelectors,
      attributes: profileIndexAttributes,
      pagination: pathPagination,
    },
    [SECTIONS.CHANNEL]: {
      baseUrl: env.sites.xvideosChannelsUrl,
      selectors: profileIndexSelectors,
      attributes: profileIndexAttributes,
      pagination: pathPagination,
    },
    [SECTIONS.TAG]: {
      baseUrl: env.sites.xvideosTagsUrl,
      selectors: {
        // Tags index has no thumbnails; keep title+url only.
        item: '#tags li',
        title: 'a[href*="/tags/"]',
        image: 'img',
        url: 'a[href*="/tags/"]',
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
        ...searchPagination,
        childrenType: 'query',
        childrenPattern: 'p={page}',
      },
      resolveChildrenBaseUrl: channelChildrenBaseUrl,
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
        item:
          '#related-videos div.thumb-block, #video-related div.thumb-block, .related-videos div.thumb-block, div.thumb-block[id^="video-thumb-"], div.thumb-block[id^="video_"]',
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
