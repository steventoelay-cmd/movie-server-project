'use strict';

const { createLogger } = require('../../infrastructure/logging/logger');
const { getStreamCache } = require('../../infrastructure/cache');
const { SiteResolver } = require('../../scrapers/core/SiteResolver');
const { PromiseLock } = require('../../infrastructure/concurrency/PromiseLock');
const { canonicalizeUrl } = require('../../utils/url.util');
const { shortHash } = require('../../utils/hash.util');
const { validateStreamUrl } = require('../../utils/stream.validator');
const { withRetry, isRetryableError } = require('../../utils/retry.util');
const { streamConfig } = require('../../config/stream.config');
const { ScrapeError } = require('../../domain/errors/ScrapeError');

const logger = createLogger('stream');

/**
 * Stream / m3u8 extraction use-case (Play button only).
 * Independent from Detail API. Never writes to GitHub JSON.
 */
class StreamService {
  /**
   * @param {object} [options]
   */
  constructor(options = {}) {
    this.cache = options.cache || getStreamCache();
    this.resolver = options.resolver || new SiteResolver();
    this.lock = options.lock || new PromiseLock();
    this.config = options.config || streamConfig;
  }

  /**
   * @param {string} url - child video page URL
   * @returns {Promise<object>} API response body
   */
  async getStream(url) {
    const started = Date.now();
    const check = this.resolver.validateChildUrl(url);
    if (!check.ok) {
      const err = new Error(check.message);
      err.statusCode = 400;
      err.code = 'INVALID_STREAM_URL';
      throw err;
    }

    const canonical = canonicalizeUrl(url);
    const lockKey = `stream:${shortHash(canonical)}`;

    return this.lock.run(lockKey, async () => {
      const cached = await this.cache.get(canonical);
      if (cached.hit && !cached.stale && cached.entry?.m3u8) {
        const validation = validateStreamUrl(cached.entry.m3u8);
        if (validation.valid) {
          const ageSec = Math.max(0, Math.floor((Date.now() - cached.entry.createdAt) / 1000));
          const expiresIn = Math.max(
            0,
            Math.floor((cached.entry.expiresAt - Date.now()) / 1000),
          );
          logger.info('Stream cache hit', {
            url: canonical,
            source: cached.source,
            ageSec,
            durationMs: Date.now() - started,
            cacheHit: true,
          });
          return buildSuccessResponse({
            streamUrl: cached.entry.m3u8,
            expiresIn,
            cacheHit: true,
            age: ageSec,
            siteId: cached.entry.payload?.siteId,
            payload: cached.entry.payload,
            durationMs: Date.now() - started,
            retries: 0,
          });
        }
      }

      logger.info('Stream cache miss', { url: canonical, durationMs: Date.now() - started });

      let retriesUsed = 0;
      try {
        const extracted = await this._extractWithRetry(canonical, (n) => {
          retriesUsed = n;
        });
        const validation = validateStreamUrl(extracted.url);
        if (!validation.valid) {
          throw new ScrapeError(`Invalid m3u8: ${validation.reason}`, {
            code: 'INVALID_M3U8',
            statusCode: 422,
            meta: { reason: validation.reason, url: canonical },
          });
        }

        const payload = {
          url: extracted.url,
          type: 'm3u8',
          validationStatus: 'valid',
          siteId: extracted.siteId,
          qualities: extracted.qualities || [],
          mirrors: extracted.mirrors || [],
          subtitles: extracted.subtitles || [],
          audioTracks: extracted.audioTracks || [],
          drm: extracted.drm || null,
          adaptive: true,
        };

        await this.cache.set(canonical, payload);

        const expiresIn = Math.floor(this.config.ttlMs / 1000);
        logger.info('Stream extraction complete', {
          url: canonical,
          siteId: extracted.siteId,
          cacheHit: false,
          retries: retriesUsed,
          extractionMs: extracted.extractionMs,
          durationMs: Date.now() - started,
        });

        return buildSuccessResponse({
          streamUrl: payload.url,
          expiresIn,
          cacheHit: false,
          age: 0,
          siteId: extracted.siteId,
          payload,
          durationMs: Date.now() - started,
          retries: retriesUsed,
        });
      } catch (error) {
        logger.error('Stream extraction failed', {
          url: canonical,
          message: error.message,
          code: error.code,
          retries: retriesUsed,
          durationMs: Date.now() - started,
        });

        if (this.config.allowStaleOnFailure) {
          const stale = await this.cache.get(canonical, { allowStale: true });
          if (stale.hit && stale.entry?.m3u8) {
            const validation = validateStreamUrl(stale.entry.m3u8);
            if (validation.valid) {
              const ageSec = Math.max(0, Math.floor((Date.now() - stale.entry.createdAt) / 1000));
              logger.warn('Returning stale stream cache after extraction failure', {
                url: canonical,
                ageSec,
              });
              return buildSuccessResponse({
                streamUrl: stale.entry.m3u8,
                expiresIn: 0,
                cacheHit: true,
                age: ageSec,
                stale: true,
                siteId: stale.entry.payload?.siteId,
                payload: stale.entry.payload,
                durationMs: Date.now() - started,
                retries: retriesUsed,
              });
            }
          }
        }

        throw error;
      }
    });
  }

  /**
   * @param {string} canonical
   * @param {(retries: number) => void} onRetryCount
   * @private
   */
  async _extractWithRetry(canonical, onRetryCount) {
    let attempt = 0;
    const extractStarted = Date.now();

    const result = await withRetry(
      async () => {
        attempt += 1;
        onRetryCount(Math.max(0, attempt - 1));
        return this._extractOnce(canonical);
      },
      {
        retries: this.config.retries,
        baseMs: this.config.retryBaseMs,
        isRetryable: (error) => error.retryable === true || isRetryableError(error),
        onRetry: ({ attempt: a, waitMs, error }) => {
          logger.warn('Retrying stream extraction', {
            url: canonical,
            attempt: a,
            waitMs,
            message: error.message,
          });
        },
      },
    );

    return {
      ...result,
      extractionMs: Date.now() - extractStarted,
    };
  }

  /**
   * @param {string} canonical
   * @private
   */
  async _extractOnce(canonical) {
    const adapter = this.resolver.resolveAdapter(canonical);
    let html = await adapter.fetchHtml(canonical, {
      timeoutMs: this.config.timeoutMs,
      retries: 0,
    });

    let parsed = adapter.parseStream(html, canonical);

    // Optional iframe follow (site-configured)
    if (!parsed.m3u8 && parsed.iframeSrc) {
      logger.debug('Following stream iframe', {
        url: canonical,
        iframeSrc: parsed.iframeSrc,
        siteId: adapter.siteId,
      });
      try {
        html = await adapter.fetchHtml(parsed.iframeSrc, {
          timeoutMs: this.config.timeoutMs,
          retries: 0,
        });
        parsed = adapter.parseStream(html, parsed.iframeSrc);
      } catch (error) {
        logger.warn('Iframe stream fetch failed', {
          iframeSrc: parsed.iframeSrc,
          message: error.message,
        });
      }
    }

    if (!parsed.m3u8) {
      const err = new ScrapeError('No playable m3u8 found on video page', {
        code: 'M3U8_NOT_FOUND',
        statusCode: 404,
        retryable: false,
        meta: { siteId: adapter.siteId, url: canonical, hadMp4: Boolean(parsed.mp4) },
      });
      throw err;
    }

    return {
      url: parsed.m3u8,
      siteId: adapter.siteId,
      qualities: [],
      mirrors: parsed.mp4 ? [{ url: parsed.mp4, type: 'mp4' }] : [],
      subtitles: [],
      audioTracks: [],
      drm: null,
    };
  }
}

function buildSuccessResponse({
  streamUrl,
  expiresIn,
  cacheHit,
  age,
  stale = false,
  siteId,
  payload,
  durationMs,
  retries,
}) {
  return {
    success: true,
    stream: {
      url: streamUrl,
      expiresIn,
      type: 'm3u8',
      // Future-compatible fields (non-breaking)
      qualities: payload?.qualities || [],
      mirrors: payload?.mirrors || [],
      subtitles: payload?.subtitles || [],
      audioTracks: payload?.audioTracks || [],
      drm: payload?.drm || null,
      adaptive: payload?.adaptive !== false,
    },
    cache: {
      hit: cacheHit,
      age,
      stale,
    },
    meta: {
      siteId: siteId || null,
      durationMs,
      retries,
      schemaVersion: 1,
    },
  };
}

module.exports = { StreamService, buildSuccessResponse };
