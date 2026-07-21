'use strict';

const { getHtml } = require('./axiosClient');
const { withRetry, isRetryableError } = require('../../utils/retry.util');
const { RequestQueue } = require('../concurrency/RequestQueue');
const { OutboundRateLimiter } = require('../concurrency/OutboundRateLimiter');
const { getHtmlPageCache } = require('../cache/HtmlPageCache');
const { scraperLogger } = require('../logging/logger');
const { ScrapeError } = require('../../domain/errors/ScrapeError');
const { scraperConfig } = require('../../config/scraper.config');
const { getMetrics } = require('../metrics/MetricsCollector');

/** Shared outbound queue (priority + concurrency). Replaces unbounded parallel fetches. */
const defaultQueue = new RequestQueue();
/** Backward-compatible alias */
const defaultLimiter = defaultQueue;

/**
 * Fetch HTML with timeout, retry, rate limiting, HTML reuse cache, and validation.
 */
class HtmlFetcher {
  /**
   * @param {object} [options]
   * @param {{ schedule: Function, stats?: Function }} [options.rateLimiter]
   * @param {object} [options.logger]
   * @param {import('../cache/HtmlPageCache').HtmlPageCache} [options.htmlCache]
   * @param {boolean} [options.skipCache]
   */
  constructor(options = {}) {
    this.rateLimiter = options.rateLimiter || defaultQueue;
    this.logger = options.logger || scraperLogger;
    this.htmlCache = options.htmlCache || getHtmlPageCache();
    this.metrics = options.metrics || getMetrics();
  }

  /**
   * @param {string} url
   * @param {object} [options]
   * @returns {Promise<string>}
   */
  async fetch(url, options = {}) {
    const started = Date.now();
    const siteId = options.siteId || 'unknown';
    const skipCache = options.skipCache === true;

    const loader = async () => {
      const response = await this.rateLimiter.schedule(
        () =>
          withRetry(
            () =>
              getHtml(url, {
                timeoutMs: options.timeoutMs,
                headers: options.headers,
                userAgent: options.userAgent,
              }),
            {
              retries: options.retries ?? scraperConfig.retries,
              baseMs: options.retryBaseMs ?? scraperConfig.retryBaseMs,
              isRetryable: isRetryableError,
              onRetry: ({ attempt, retries, waitMs, error }) => {
                this.logger.warn('Retrying HTML fetch', {
                  siteId,
                  url,
                  attempt,
                  retries,
                  waitMs,
                  message: error.message,
                });
              },
            },
          ),
        { priority: options.priority ?? 50 },
      );

      const html = response.data;
      this.validateHtmlResponse(html, url, response.status);
      return html;
    };

    try {
      const html = skipCache
        ? await loader()
        : await this.htmlCache.getOrLoad(url, loader);

      const durationMs = Date.now() - started;
      this.metrics.timing('html.fetch', durationMs);
      this.metrics.incr('html.fetch.ok');

      this.logger.debug('HTML fetched', {
        siteId,
        url,
        bytes: typeof html === 'string' ? html.length : 0,
        durationMs,
      });

      return html;
    } catch (error) {
      this.metrics.incr('html.fetch.fail');
      if (error instanceof ScrapeError) {
        throw error;
      }
      const status = error.response?.status;
      throw new ScrapeError('Failed to fetch HTML', {
        code: 'FETCH_FAILED',
        statusCode: status && status >= 400 && status < 500 ? 400 : 502,
        retryable: isRetryableError(error),
        meta: { siteId, url, status, message: error.message },
        cause: error,
      });
    }
  }

  /**
   * @param {*} html
   * @param {string} url
   * @param {number} status
   */
  validateHtmlResponse(html, url, status) {
    if (typeof html !== 'string' || html.trim().length === 0) {
      throw new ScrapeError('Empty or invalid HTML response', {
        code: 'INVALID_HTML',
        statusCode: 502,
        retryable: false,
        meta: { url, status },
      });
    }
  }
}

const defaultHtmlFetcher = new HtmlFetcher();

module.exports = {
  HtmlFetcher,
  defaultHtmlFetcher,
  defaultLimiter,
  defaultQueue,
  OutboundRateLimiter,
};
