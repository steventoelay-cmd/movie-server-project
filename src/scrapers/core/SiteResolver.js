'use strict';

const { isValidHttpUrl } = require('../../utils/url.util');
const { assertSafeFetchUrl } = require('../../utils/ssrf.util');
const { apiConfig } = require('../../config/api.config');
const { ScrapeError } = require('../../domain/errors/ScrapeError');
const { registerSites } = require('../registerSites');
const { defaultRegistry } = require('../core/AdapterRegistry');

/**
 * Resolve which site adapter should handle a child video URL.
 */
class SiteResolver {
  /**
   * @param {object} [options]
   * @param {import('../core/AdapterRegistry').AdapterRegistry} [options.registry]
   * @param {string[]} [options.allowedHosts]
   */
  constructor(options = {}) {
    this.registry = options.registry || defaultRegistry;
    registerSites(this.registry);
    this.extraAllowedHosts = (options.allowedHosts || apiConfig.allowedHosts || []).map((h) =>
      String(h).toLowerCase().replace(/^www\./, ''),
    );
  }

  /**
   * Collect allowlisted hosts from adapters + env.
   * @returns {string[]}
   */
  allowedHosts() {
    const hosts = new Set(this.extraAllowedHosts);
    for (const siteId of this.registry.list()) {
      const adapter = this.registry.get(siteId);
      for (const h of adapter.detailHosts || []) {
        hosts.add(h);
      }
      for (const cfg of Object.values(adapter.sectionConfigs || {})) {
        if (cfg?.baseUrl) {
          try {
            hosts.add(new URL(cfg.baseUrl).hostname.toLowerCase().replace(/^www\./, ''));
          } catch {
            // ignore
          }
        }
      }
    }
    return [...hosts];
  }

  /**
   * @param {string} url
   * @returns {{ ok: boolean, hostname?: string, message?: string, code?: string }}
   */
  validateChildUrl(url) {
    const ssrf = assertSafeFetchUrl(url);
    if (!ssrf.ok) {
      return { ok: false, message: ssrf.message, code: ssrf.code };
    }

    if (!isValidHttpUrl(ssrf.url.href)) {
      return { ok: false, message: 'url must be a valid http(s) URL', code: 'URL_MALFORMED' };
    }

    const hostname = ssrf.url.hostname.toLowerCase().replace(/^www\./, '');
    const allowed = this.allowedHosts();
    if (allowed.length && !allowed.some((h) => hostname === h || hostname.endsWith(`.${h}`))) {
      return {
        ok: false,
        message: 'url host is not allowlisted',
        hostname,
        code: 'URL_HOST_NOT_ALLOWED',
      };
    }

    return { ok: true, hostname };
  }

  /**
   * @param {string} url
   * @returns {import('../core/SiteAdapter').SiteAdapter}
   */
  resolveAdapter(url) {
    const check = this.validateChildUrl(url);
    if (!check.ok) {
      throw new ScrapeError(check.message || 'Invalid url', {
        code: check.code || 'INVALID_DETAIL_URL',
        statusCode: 400,
        meta: { hostname: check.hostname },
      });
    }

    const hostname = check.hostname;
    for (const siteId of this.registry.list()) {
      const adapter = this.registry.get(siteId);
      if (adapter.matchesHost(hostname) && adapter.detailConfig) {
        return adapter;
      }
    }

    for (const siteId of this.registry.list()) {
      const adapter = this.registry.get(siteId);
      if (adapter.detailConfig) {
        return adapter;
      }
    }

    throw new ScrapeError('No site adapter available for detail scraping', {
      code: 'DETAIL_ADAPTER_MISSING',
      statusCode: 501,
      meta: { hostname },
    });
  }
}

module.exports = { SiteResolver };
