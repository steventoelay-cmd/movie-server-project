'use strict';

/**
 * Play resolver: Cloudflare Worker first, AWS /stream if that does not yield a URL.
 * Call again with skipCloudflare=true when the player rejects the Worker URL.
 */

const WORKER_TIMEOUT_MS = 8000;
const AWS_TIMEOUT_MS = 20000;

function readStreamUrl(body) {
  const url = body && body.stream && body.stream.url;
  if (!url || typeof url !== 'string') return null;
  return {
    url,
    expiresIn: Number(body.stream.expiresIn) || 0,
    type: body.stream.type || (url.includes('.mp4') ? 'mp4' : 'm3u8'),
  };
}

function withTimeout(promise, timeoutMs) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const error = new Error('request timed out');
      error.code = 'TIMEOUT';
      reject(error);
    }, timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function fetchJson(fetchImpl, url, headers, timeoutMs) {
  const response = await withTimeout(
    fetchImpl(url, {
      method: 'GET',
      headers,
    }),
    timeoutMs,
  );
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  return { ok: response.ok, status: response.status, body };
}

/**
 * @param {object} options
 * @param {string} options.pageUrl - child video page URL
 * @param {string} [options.workerBaseUrl] - Worker origin, no trailing path
 * @param {string} options.apiBaseUrl - AWS API origin
 * @param {string} [options.apiKey]
 * @param {string} [options.workerKey]
 * @param {boolean} [options.skipCloudflare] - player already rejected the Worker URL
 * @param {Function} [options.fetch]
 */
async function resolveStreamUrl(options) {
  const pageUrl = String(options.pageUrl || '').trim();
  if (!pageUrl) {
    const error = new Error('pageUrl is required');
    error.code = 'URL_REQUIRED';
    throw error;
  }
  const fetchImpl = options.fetch || fetch;
  const workerBase = String(options.workerBaseUrl || '').replace(/\/+$/, '');
  const apiBase = String(options.apiBaseUrl || '').replace(/\/+$/, '');
  if (!apiBase) {
    const error = new Error('apiBaseUrl is required');
    error.code = 'API_BASE_REQUIRED';
    throw error;
  }

  if (!options.skipCloudflare && workerBase) {
    try {
      const headers = { Accept: 'application/json' };
      if (options.workerKey) headers['X-Stream-Key'] = options.workerKey;
      const workerUrl = `${workerBase}?url=${encodeURIComponent(pageUrl)}`;
      const result = await fetchJson(
        fetchImpl,
        workerUrl,
        headers,
        options.workerTimeoutMs || WORKER_TIMEOUT_MS,
      );
      const stream = result.ok ? readStreamUrl(result.body) : null;
      if (stream) {
        return { source: 'cloudflare', ...stream };
      }
    } catch {
      // Fall through to AWS.
    }
  }

  const headers = { Accept: 'application/json' };
  if (options.apiKey) headers['X-Api-Key'] = options.apiKey;
  const awsUrl = `${apiBase}/stream?url=${encodeURIComponent(pageUrl)}`;
  const aws = await fetchJson(fetchImpl, awsUrl, headers, options.awsTimeoutMs || AWS_TIMEOUT_MS);
  const stream = aws.ok ? readStreamUrl(aws.body) : null;
  if (!stream) {
    const error = new Error((aws.body && aws.body.message) || 'AWS stream request failed');
    error.code = (aws.body && aws.body.code) || 'AWS_STREAM_FAILED';
    error.status = aws.status;
    throw error;
  }
  return { source: 'aws', ...stream };
}

module.exports = {
  resolveStreamUrl,
  readStreamUrl,
};
