'use strict';

const { SECTIONS, isValidSection } = require('../../domain/constants/sections');
const { ScrapeError } = require('../../domain/errors/ScrapeError');
const { defaultHtmlFetcher } = require('../../infrastructure/http/HtmlFetcher');
const { scraperLogger } = require('../../infrastructure/logging/logger');
const { parseList } = require('../parsers/parseList');
const { parseDetail } = require('../parsers/parseDetail');
const { parseStream } = require('../parsers/parseStream');
const { DEFAULT_STREAM_EXTRACTION } = require('../parsers/streamDefaults');
const { normalizeVideoList } = require('../normalizers/videoItem.normalizer');
const { normalizeDetail } = require('../normalizers/detail.normalizer');
const { buildPaginatedUrl, buildChildrenPaginatedUrl } = require('./pagination');

/**
 * Base site adapter. Website modules extend this or use SelectorSiteAdapter.
 * Common modules never contain website-specific selectors.
 */
class SiteAdapter {
  /**
   * @param {object} options
   * @param {string} options.siteId
   * @param {string[]} [options.supportedSections]
   * @param {object} [options.headers]
   * @param {import('../../infrastructure/http/HtmlFetcher').HtmlFetcher} [options.fetcher]
   * @param {object} [options.logger]
   */
  constructor(options) {
    if (!options || !options.siteId) {
      throw new ScrapeError('siteId is required for SiteAdapter', {
        code: 'ADAPTER_CONFIG',
        statusCode: 500,
      });
    }
    this.siteId = options.siteId;
    this.supportedSections = options.supportedSections || Object.values(SECTIONS);
    this.headers = options.headers || {};
    this.fetcher = options.fetcher || defaultHtmlFetcher;
    this.logger = options.logger || scraperLogger;
    this.detailHosts = (options.detailHosts || []).map((h) =>
      String(h).toLowerCase().replace(/^www\./, ''),
    );
    /** @type {RegExp[]} pathname patterns that identify child/watch video pages */
    this.childUrlPatterns = Array.isArray(options.childUrlPatterns)
      ? options.childUrlPatterns.filter((p) => p instanceof RegExp)
      : [];
  }

  /** @param {string} section */
  supportsSection(section) {
    return this.supportedSections.includes(section);
  }

  /**
   * Whether URL looks like a child video page (not parent index/profile).
   * When no patterns are configured, returns true (host allowlist alone).
   * @param {string} url
   * @returns {boolean}
   */
  isChildVideoUrl(url) {
    if (!this.childUrlPatterns.length) {
      return true;
    }
    try {
      const pathname = new URL(url).pathname || '';
      return this.childUrlPatterns.some((re) => re.test(pathname));
    } catch {
      return false;
    }
  }

  /**
   * @param {string} url
   * @param {object} [ctx]
   * @returns {Promise<string>}
   */
  async fetchHtml(url, ctx = {}) {
    return this.fetcher.fetch(url, {
      siteId: this.siteId,
      headers: { ...this.headers, ...(ctx.headers || {}) },
      timeoutMs: ctx.timeoutMs,
      userAgent: ctx.userAgent,
      retries: ctx.retries,
    });
  }

  /** @returns {never} */
  _notImplemented(method) {
    throw new ScrapeError(`${this.siteId} adapter does not implement ${method}`, {
      code: 'ADAPTER_NOT_IMPLEMENTED',
      statusCode: 501,
      meta: { siteId: this.siteId, method },
    });
  }

  parseHome() {
    this._notImplemented('parseHome');
  }

  parseModelParents() {
    this._notImplemented('parseModelParents');
  }

  parseChannelParents() {
    this._notImplemented('parseChannelParents');
  }

  parseTagParents() {
    this._notImplemented('parseTagParents');
  }

  parseChildren() {
    this._notImplemented('parseChildren');
  }

  parseDetail() {
    this._notImplemented('parseDetail');
  }

  parseRelated() {
    this._notImplemented('parseRelated');
  }

  parseStream() {
    this._notImplemented('parseStream');
  }

  /**
   * Whether this adapter can parse detail pages for a given host.
   * @param {string} [hostname]
   * @returns {boolean}
   */
  matchesHost(hostname) {
    const hosts = this.detailHosts || [];
    if (!hostname || !hosts.length) {
      return false;
    }
    const host = String(hostname).toLowerCase().replace(/^www\./, '');
    return hosts.some((h) => host === h || host.endsWith(`.${h}`));
  }

  buildSectionUrl() {
    this._notImplemented('buildSectionUrl');
  }

  buildChildrenUrl() {
    this._notImplemented('buildChildrenUrl');
  }

  /**
   * Shared normalize helper for adapters.
   * @param {Array<object>} raw
   * @param {string} section
   */
  normalize(raw, section) {
    return normalizeVideoList(raw, {
      logger: this.logger,
      siteId: this.siteId,
      section,
    });
  }
}

/**
 * Selector-driven adapter: all site HTML differences live in sectionConfigs.
 */
class SelectorSiteAdapter extends SiteAdapter {
  /**
   * @param {object} options
   * @param {string} options.siteId
   * @param {object} options.sectionConfigs - map section -> { baseUrl, selectors, attributes, pagination }
   * @param {object} [options.childrenConfigs] - map section -> list config for child pages
   * @param {object} [options.detailConfig] - detail + related selectors (no m3u8)
   * @param {object} [options.streamConfig] - m3u8 extraction config (Play only)
   * @param {string[]} [options.detailHosts] - hostnames this adapter handles for /detail
   * @param {RegExp[]} [options.childUrlPatterns] - pathname patterns for watch/child pages
   * @param {string[]} [options.supportedSections]
   * @param {object} [options.headers]
   */
  constructor(options) {
    const sectionConfigs = options.sectionConfigs || {};
    const supported =
      options.supportedSections ||
      Object.keys(sectionConfigs).filter((k) => sectionConfigs[k] && sectionConfigs[k].baseUrl);

    super({
      siteId: options.siteId,
      supportedSections: supported,
      headers: options.headers,
      fetcher: options.fetcher,
      logger: options.logger,
      detailHosts: options.detailHosts,
      childUrlPatterns: options.childUrlPatterns,
    });

    this.sectionConfigs = sectionConfigs;
    this.childrenConfigs = options.childrenConfigs || {};
    this.detailConfig = options.detailConfig || null;
    this.streamConfig = options.streamConfig || { videoExtraction: DEFAULT_STREAM_EXTRACTION };
    this.detailHosts = (options.detailHosts || []).map((h) =>
      String(h).toLowerCase().replace(/^www\./, ''),
    );
    this.childUrlPatterns = Array.isArray(options.childUrlPatterns)
      ? options.childUrlPatterns.filter((p) => p instanceof RegExp)
      : this.childUrlPatterns;
  }

  /** @param {string} section */
  getSectionConfig(section) {
    const config = this.sectionConfigs[section];
    if (!config) {
      throw new ScrapeError(`Section not configured for site`, {
        code: 'SECTION_NOT_CONFIGURED',
        statusCode: 501,
        meta: { siteId: this.siteId, section },
      });
    }
    return config;
  }

  /**
   * @param {string} section
   * @param {number} [page]
   */
  buildSectionUrl(section, page = 1) {
    if (!isValidSection(section)) {
      throw new ScrapeError('Invalid section', {
        code: 'INVALID_SECTION',
        statusCode: 400,
        meta: { section },
      });
    }
    const config = this.getSectionConfig(section);
    return buildPaginatedUrl(config.baseUrl, page, config.pagination || {});
  }

  /**
   * @param {string} section
   * @param {string} parentUrl
   * @param {number} [page]
   */
  buildChildrenUrl(section, parentUrl, page = 1) {
    const parentConfig = this.sectionConfigs[section] || {};
    const childConfig = this.childrenConfigs[section] || {};
    const pagination = childConfig.pagination || parentConfig.pagination || {};
    let baseUrl = parentUrl;
    if (typeof childConfig.resolveChildrenBaseUrl === 'function') {
      baseUrl = childConfig.resolveChildrenBaseUrl(parentUrl) || parentUrl;
    }
    return buildChildrenPaginatedUrl(baseUrl, page, pagination);
  }

  _parseWithConfig(html, pageUrl, listConfig, section) {
    const raw = parseList(html, listConfig, pageUrl);
    return this.normalize(raw, section).items;
  }

  parseHome(html, pageUrl) {
    return this._parseWithConfig(html, pageUrl, this.getSectionConfig(SECTIONS.HOME), SECTIONS.HOME);
  }

  parseMyanmar(html, pageUrl) {
    return this._parseWithConfig(
      html,
      pageUrl,
      this.getSectionConfig(SECTIONS.MYANMAR),
      SECTIONS.MYANMAR,
    );
  }

  parseModelParents(html, pageUrl) {
    return this._parseWithConfig(html, pageUrl, this.getSectionConfig(SECTIONS.MODEL), SECTIONS.MODEL);
  }

  parseChannelParents(html, pageUrl) {
    return this._parseWithConfig(
      html,
      pageUrl,
      this.getSectionConfig(SECTIONS.CHANNEL),
      SECTIONS.CHANNEL,
    );
  }

  parseTagParents(html, pageUrl) {
    return this._parseWithConfig(html, pageUrl, this.getSectionConfig(SECTIONS.TAG), SECTIONS.TAG);
  }

  /**
   * Child videos: metadata only (title, img, url). No detail/related/stream.
   * @param {string} html
   * @param {string} pageUrl
   * @param {string} section
   */
  parseChildren(html, pageUrl, section) {
    const listConfig =
      this.childrenConfigs[section] ||
      this.sectionConfigs[section] || {
        selectors: null,
      };
    return this._parseWithConfig(html, pageUrl, listConfig, `${section}:children`);
  }

  /**
   * Parse video details + one-level related. Never extracts m3u8.
   * @param {string} html
   * @param {string} pageUrl
   */
  parseDetail(html, pageUrl) {
    if (!this.detailConfig) {
      throw new ScrapeError('Detail parsing not configured for site', {
        code: 'DETAIL_NOT_CONFIGURED',
        statusCode: 501,
        meta: { siteId: this.siteId },
      });
    }
    const raw = parseDetail(html, this.detailConfig, pageUrl);
    return normalizeDetail(raw, pageUrl, {
      logger: this.logger,
      siteId: this.siteId,
    });
  }

  /**
   * Related-only parse (one level). Prefer parseDetail for full responses.
   * @param {string} html
   * @param {string} pageUrl
   */
  parseRelated(html, pageUrl) {
    if (!this.detailConfig?.related) {
      return [];
    }
    const raw = parseList(html, this.detailConfig.related, pageUrl);
    return this.normalize(raw, 'related').items;
  }

  /**
   * Extract m3u8 from child video page HTML. Never called from Detail API.
   * @param {string} html
   * @param {string} pageUrl
   * @returns {{ m3u8: string|null, mp4: string|null, iframeSrc: string|null }}
   */
  parseStream(html, pageUrl) {
    const cfg = this.streamConfig || { videoExtraction: DEFAULT_STREAM_EXTRACTION };
    return parseStream(html, cfg, pageUrl);
  }
}

module.exports = {
  SiteAdapter,
  SelectorSiteAdapter,
};
