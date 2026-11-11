'use strict';

/**
 * Stream URL extraction for the Cloudflare Worker.
 * Same job as StreamService: read a child video page, return an m3u8 or mp4 URL.
 * No Node APIs, so the Worker bundle and Jest can both load this file.
 */

const TTL_SEC = 4 * 60;
const MAX_IFRAME_DEPTH = 2;
const PAGE_TIMEOUT_MS = 8000;

const ALLOWED_HOSTS = [
  { host: 'xvideos.com', siteId: 'xvideos', child: [/^\/video\.?[0-9a-z]+(?:\/|$)/i, /^\/embedframe\//i] },
  { host: 'tubev.sex', siteId: 'tubev', child: [/^\/videos?\//i, /^\/video\//i, /^\/watch\//i, /^\/embed\//i] },
  { host: 'sexvid.xxx', siteId: 'sexvid', child: [/^\/videos?\//i, /^\/video\//i, /^\/watch\//i, /^\/embed\//i] },
];

const M3U8_PATTERNS = [
  /setVideoHLS\s*\(\s*['"]([^'"]+)['"]/i,
  /html5player\.setVideoHLS\s*\(\s*['"]([^'"]+)['"]/i,
  /"(https?:\/\/[^"\\]+\.m3u8[^"\\]*)"/i,
  /'(https?:\/\/[^'\\]+\.m3u8[^'\\]*)'/i,
  /hlsUrl\s*[=:]\s*["']([^"']+\.m3u8[^"']*)["']/i,
  /file\s*:\s*["']([^"']+\.m3u8[^"']*)["']/i,
  /src\s*[=:]\s*["']([^"']+\.m3u8[^"']*)["']/i,
  /m3u8\s*[=:]\s*["']([^"']+\.m3u8[^"']*)["']/i,
];

const MP4_PATTERNS = [
  /setVideoUrlHigh\s*\(\s*['"]([^'"]+)['"]/i,
  /setVideoUrlLow\s*\(\s*['"]([^'"]+)['"]/i,
  /"(https?:\/\/[^"\\]+\.mp4[^"\\]*)"/i,
  /file\s*:\s*["']([^"']+\.mp4[^"']*)["']/i,
];

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

function cleanExtracted(value) {
  return String(value || '')
    .replace(/\\u0026/gi, '&')
    .replace(/\\u002f/gi, '/')
    .replace(/\\\//g, '/')
    .replace(/&amp;/g, '&')
    .trim();
}

/**
 * Watch pages from a datacenter often omit the player. The embed page is smaller
 * and still contains setVideoHLS.
 * @param {string} pageUrl
 * @returns {string|null}
 */
function xvideosEmbedUrl(pageUrl) {
  let url;
  try {
    url = new URL(pageUrl);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  if (host !== 'xvideos.com' && !host.endsWith('.xvideos.com')) return null;
  if (/^\/embedframe\//i.test(url.pathname)) return null;
  const match = url.pathname.match(/^\/video\.?([0-9a-z]+)/i);
  if (!match) return null;
  return `${url.protocol}//${url.host}/embedframe/${match[1]}`;
}

function matchPatterns(html, patterns) {
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match && match[1]) {
      return cleanExtracted(match[1]);
    }
  }
  return null;
}

function attrUrl(html, attrRe) {
  const match = html.match(attrRe);
  const value = match && (match[1] || match[2]);
  return value ? cleanExtracted(value) : null;
}

/**
 * @param {string} html
 * @param {string} pageUrl
 * @returns {{ m3u8: string|null, mp4: string|null, iframeSrc: string|null }}
 */
function parseStreamHtml(html, pageUrl) {
  const source = String(html || '');
  let m3u8 =
    attrUrl(
      source,
      /<(?:source|video)\b[^>]*(?:type=["']application\/x-mpegURL["'][^>]*src=["']([^"']+)["']|src=["']([^"']+\.m3u8[^"']*)["'])[^>]*>/i,
    ) || matchPatterns(source, M3U8_PATTERNS);

  if (!m3u8) {
    const loose = source.match(/src=["']([^"']+\.m3u8[^"']*)["']/i);
    m3u8 = loose ? cleanExtracted(loose[1]) : null;
  }

  let mp4 =
    attrUrl(source, /<(?:source|video)\b[^>]*src=["']([^"']+\.mp4[^"']*)["'][^>]*>/i) ||
    matchPatterns(source, MP4_PATTERNS);

  const og = source.match(
    /<meta\b[^>]*property=["']og:video(?::url)?["'][^>]*content=["']([^"']+)["'][^>]*>/i,
  );
  if (og && og[1]) {
    const content = cleanExtracted(og[1]);
    if (!m3u8 && content.includes('.m3u8')) m3u8 = content;
    else if (!mp4 && content.includes('.mp4')) mp4 = content;
  }

  let iframeSrc = null;
  const iframeRe = /<iframe\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi;
  let iframeMatch;
  const iframes = [];
  while ((iframeMatch = iframeRe.exec(source))) {
    iframes.push(cleanExtracted(iframeMatch[1]));
  }
  const preferred = iframes.find((src) => /embed|player/i.test(src)) || iframes[0] || null;
  if (preferred) {
    try {
      iframeSrc = new URL(preferred, pageUrl).href;
    } catch {
      iframeSrc = null;
    }
  }

  if (m3u8) {
    try {
      m3u8 = new URL(m3u8, pageUrl).href;
    } catch {
      m3u8 = null;
    }
  }
  if (mp4) {
    try {
      mp4 = new URL(mp4, pageUrl).href;
    } catch {
      mp4 = null;
    }
  }

  return { m3u8, mp4, iframeSrc };
}

function isPrivateHost(hostname) {
  const host = String(hostname || '').toLowerCase().replace(/\.$/, '');
  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host === '0.0.0.0' ||
    host === 'metadata.google.internal'
  ) {
    return true;
  }
  const v4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!v4) return false;
  const a = Number(v4[1]);
  const b = Number(v4[2]);
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a >= 224) return true;
  return false;
}

/**
 * @param {string} rawUrl
 * @returns {{ ok: true, url: URL, siteId: string } | { ok: false, code: string, message: string, status: number }}
 */
function validatePageUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string' || !rawUrl.trim()) {
    return { ok: false, status: 400, code: 'URL_REQUIRED', message: 'url query parameter is required' };
  }
  if (rawUrl.length > 2048) {
    return { ok: false, status: 400, code: 'URL_TOO_LONG', message: 'url is too long' };
  }
  let url;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    return { ok: false, status: 400, code: 'URL_MALFORMED', message: 'url must be a valid http(s) URL' };
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { ok: false, status: 400, code: 'URL_MALFORMED', message: 'url must be a valid http(s) URL' };
  }
  url.hash = '';
  const hostname = url.hostname.toLowerCase().replace(/^www\./, '');
  if (isPrivateHost(hostname)) {
    return { ok: false, status: 400, code: 'URL_BLOCKED', message: 'url host is not allowed' };
  }
  const site = ALLOWED_HOSTS.find((entry) => hostname === entry.host || hostname.endsWith(`.${entry.host}`));
  if (!site) {
    return { ok: false, status: 400, code: 'URL_HOST_NOT_ALLOWED', message: 'url host is not allowlisted' };
  }
  const path = url.pathname || '';
  if (!site.child.some((re) => re.test(path))) {
    return {
      ok: false,
      status: 400,
      code: 'URL_NOT_CHILD_VIDEO',
      message: 'url is not a child video page',
    };
  }
  return { ok: true, url, siteId: site.siteId };
}

function validateStreamUrl(raw) {
  if (!raw) return { valid: false, reason: 'empty_url' };
  let url;
  try {
    url = new URL(raw);
  } catch {
    return { valid: false, reason: 'invalid_url' };
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { valid: false, reason: 'invalid_url' };
  }
  const lower = url.href.toLowerCase();
  if (lower.endsWith('.html') || lower.endsWith('.htm')) {
    return { valid: false, reason: 'unsupported_format' };
  }
  const isM3u8 = lower.includes('.m3u8');
  const isMp4 = lower.includes('.mp4');
  if (!isM3u8 && !isMp4) return { valid: false, reason: 'unsupported_format' };
  return { valid: true, type: isM3u8 ? 'm3u8' : 'mp4', url: url.href };
}

function buildSuccessBody({ streamUrl, type, siteId, expiresIn, cacheHit, age, durationMs }) {
  return {
    success: true,
    stream: {
      url: streamUrl,
      expiresIn,
      type,
      qualities: [],
      mirrors: [],
      subtitles: [],
      audioTracks: [],
      drm: null,
      adaptive: type !== 'mp4',
    },
    cache: { hit: Boolean(cacheHit), age: age || 0, stale: false },
    meta: { siteId: siteId || null, durationMs: durationMs || 0, retries: 0, schemaVersion: 1, source: 'cloudflare' },
  };
}

function jsonResponse(status, body, extraHeaders) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'private, max-age=0',
      ...(extraHeaders || {}),
    },
  });
}

function corsHeaders(request, env) {
  const configured = (env && env.ALLOW_ORIGIN) || '*';
  const origin = request.headers.get('Origin');
  const allow = configured === '*' ? '*' : configured.split(',').map((s) => s.trim()).includes(origin) ? origin : configured.split(',')[0];
  return {
    'access-control-allow-origin': allow || '*',
    'access-control-allow-methods': 'GET, OPTIONS',
    'access-control-allow-headers': 'Content-Type, X-Stream-Key',
    'access-control-max-age': '600',
  };
}

function cacheKeyFor(pageUrl) {
  const href = `https://stream-cache.internal/v1?url=${encodeURIComponent(pageUrl)}`;
  if (typeof Request === 'function') {
    return new Request(href, { method: 'GET' });
  }
  return href;
}

function timeoutSignal(timeoutMs) {
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    return AbortSignal.timeout(timeoutMs);
  }
  if (typeof AbortController === 'undefined') return undefined;
  const controller = new AbortController();
  setTimeout(() => controller.abort(), timeoutMs);
  return controller.signal;
}

async function fetchHtml(fetchImpl, target, referer, timeoutMs) {
  const response = await fetchImpl(target, {
    redirect: 'follow',
    signal: timeoutSignal(timeoutMs),
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      Referer: referer || target,
      'sec-ch-ua': '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Windows"',
      'sec-fetch-dest': 'document',
      'sec-fetch-mode': 'navigate',
      'upgrade-insecure-requests': '1',
    },
  });
  if (!response.ok) {
    const error = new Error(`Page fetch failed (${response.status})`);
    error.code = 'FETCH_FAILED';
    error.status = response.status >= 500 ? 502 : 404;
    throw error;
  }
  return response.text();
}

/**
 * Fetch the video page and extract a playlist URL.
 * @param {string} pageUrl
 * @param {{ fetch?: Function, timeoutMs?: number }} [options]
 */
async function extractStreamFromPage(pageUrl, options = {}) {
  const fetchImpl = options.fetch || fetch;
  const timeoutMs = options.timeoutMs || PAGE_TIMEOUT_MS;
  const check = validatePageUrl(pageUrl);
  if (!check.ok) {
    const error = new Error(check.message);
    error.code = check.code;
    error.status = check.status;
    throw error;
  }

  let currentUrl = check.url.href;
  let referer = currentUrl;
  let html = await fetchHtml(fetchImpl, currentUrl, referer, timeoutMs);
  let parsed = parseStreamHtml(html, currentUrl);

  const embedUrl = xvideosEmbedUrl(check.url.href);
  if (!parsed.m3u8 && !parsed.mp4 && embedUrl) {
    try {
      html = await fetchHtml(fetchImpl, embedUrl, check.url.href, timeoutMs);
      const embedParsed = parseStreamHtml(html, embedUrl);
      if (embedParsed.m3u8 || embedParsed.mp4 || embedParsed.iframeSrc) {
        parsed = embedParsed;
        currentUrl = embedUrl;
      }
    } catch {
      // Keep the watch-page result and try an iframe below.
    }
  }

  let depth = 0;

  while (!parsed.m3u8 && !parsed.mp4 && parsed.iframeSrc && depth < MAX_IFRAME_DEPTH) {
    const iframeCheck = validatePageUrl(parsed.iframeSrc);
    const iframeHostOk = (() => {
      try {
        const host = new URL(parsed.iframeSrc).hostname.toLowerCase();
        return !isPrivateHost(host);
      } catch {
        return false;
      }
    })();
    if (!iframeHostOk) break;
    if (!iframeCheck.ok && iframeCheck.code === 'URL_BLOCKED') break;
    depth += 1;
    referer = currentUrl;
    currentUrl = parsed.iframeSrc;
    try {
      html = await fetchHtml(fetchImpl, currentUrl, referer, timeoutMs);
      parsed = parseStreamHtml(html, currentUrl);
    } catch {
      break;
    }
  }

  const candidate = parsed.m3u8 || parsed.mp4;
  const validated = validateStreamUrl(candidate);
  if (!validated.valid) {
    const sawPlayer = String(html || '').includes('setVideoHLS');
    const error = new Error(
      sawPlayer
        ? 'No playable stream found on video page'
        : 'Video page did not include a player script',
    );
    error.code = sawPlayer ? 'M3U8_NOT_FOUND' : 'ORIGIN_BLOCKED';
    error.status = sawPlayer ? 404 : 502;
    throw error;
  }
  return { url: validated.url, type: validated.type, siteId: check.siteId };
}

/**
 * Worker entry. Injectable fetch/caches keep tests off the network.
 * @param {Request} request
 * @param {object} [env]
 * @param {object} [deps]
 */
async function handleWorkerRequest(request, env = {}, deps = {}) {
  const started = Date.now();
  const cors = corsHeaders(request, env);
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors });
  }
  if (request.method !== 'GET') {
    return jsonResponse(405, { success: false, code: 'METHOD_NOT_ALLOWED', message: 'GET only' }, cors);
  }

  const secret = env.STREAM_WORKER_SECRET || '';
  if (secret && request.headers.get('x-stream-key') !== secret) {
    return jsonResponse(401, { success: false, code: 'UNAUTHORIZED', message: 'Invalid stream key' }, cors);
  }

  const pageUrl = new URL(request.url).searchParams.get('url') || '';
  const check = validatePageUrl(pageUrl);
  if (!check.ok) {
    return jsonResponse(check.status, { success: false, code: check.code, message: check.message }, cors);
  }

  const cacheStore = deps.caches || (typeof caches !== 'undefined' ? caches : null);
  const cache = cacheStore && cacheStore.default ? cacheStore.default : null;
  const key = cacheKeyFor(check.url.href);
  if (cache) {
    const hit = await cache.match(key);
    if (hit) {
      const cached = await hit.json();
      const age = Math.max(0, Math.floor((Date.now() - (cached.meta?.cachedAt || Date.now())) / 1000));
      cached.cache = { hit: true, age, stale: false };
      cached.stream.expiresIn = Math.max(0, TTL_SEC - age);
      return jsonResponse(200, cached, { ...cors, 'x-cache': 'HIT' });
    }
  }

  try {
    const extracted = await extractStreamFromPage(check.url.href, {
      fetch: deps.fetch,
      timeoutMs: Number(env.PAGE_TIMEOUT_MS) || PAGE_TIMEOUT_MS,
    });
    const body = buildSuccessBody({
      streamUrl: extracted.url,
      type: extracted.type,
      siteId: extracted.siteId,
      expiresIn: TTL_SEC,
      cacheHit: false,
      age: 0,
      durationMs: Date.now() - started,
    });
    body.meta.cachedAt = Date.now();
    const response = jsonResponse(200, body, { ...cors, 'x-cache': 'MISS' });
    if (cache) {
      const stored = jsonResponse(200, body, { 'cache-control': `public, max-age=${TTL_SEC}` });
      await cache.put(key, stored);
    }
    return response;
  } catch (error) {
    const status = error.status || 502;
    return jsonResponse(
      status,
      { success: false, code: error.code || 'STREAM_EXTRACT_FAILED', message: error.message || 'Stream extract failed' },
      cors,
    );
  }
}

module.exports = {
  TTL_SEC,
  parseStreamHtml,
  validatePageUrl,
  validateStreamUrl,
  buildSuccessBody,
  extractStreamFromPage,
  handleWorkerRequest,
};
