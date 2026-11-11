'use strict';

if (typeof global.Response !== 'function') {
  global.Response = class Response {
    constructor(body, init = {}) {
      this.status = init.status || 200;
      this.headers = init.headers || {};
      this._body = body;
    }

    async json() {
      return JSON.parse(this._body || 'null');
    }

    async text() {
      return this._body == null ? '' : String(this._body);
    }
  };
}

const { parseStreamHtml, validatePageUrl, handleWorkerRequest } = require('../../cloudflare/stream-worker/src/extract');
const { resolveStreamUrl } = require('../../cloudflare/stream-fallback');

const PAGE = 'https://www.xvideos.com/video.abc123/sample';
const PLAYLIST = 'https://cdn.example.com/play.m3u8?token=abc';

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  };
}

function workerRequest(url) {
  return {
    method: 'GET',
    url: `https://movies-stream.test/?url=${encodeURIComponent(url)}`,
    headers: { get: () => null },
  };
}

describe('cloudflare stream extract', () => {
  test('reads an m3u8 from a video page', () => {
    const html =
      '<video><source type="application/x-mpegURL" src="https://cdn.example.com/play.m3u8?token=abc" /></video>';
    const parsed = parseStreamHtml(html, PAGE);
    expect(parsed.m3u8).toBe('https://cdn.example.com/play.m3u8?token=abc');
  });

  test('reads setVideoHLS and rejects a parent page', () => {
    const html = '<script>html5player.setVideoHLS(\'https://cdn.example.com/hls.m3u8\');</script>';
    expect(parseStreamHtml(html, PAGE).m3u8).toBe('https://cdn.example.com/hls.m3u8');
    const parent = validatePageUrl('https://www.xvideos.com/tags/amateur');
    expect(parent.ok).toBe(false);
    expect(parent.code).toBe('URL_NOT_CHILD_VIDEO');
  });

  test('uses the xvideos embed page when the watch page has no player', async () => {
    const { extractStreamFromPage } = require('../../cloudflare/stream-worker/src/extract');
    const calls = [];
    const fetchImpl = async (url) => {
      calls.push(String(url));
      if (String(url).includes('/embedframe/')) {
        return {
          ok: true,
          status: 200,
          text: async () => `<script>html5player.setVideoHLS('${PLAYLIST}');</script>`,
        };
      }
      return { ok: true, status: 200, text: async () => '<html>no player</html>' };
    };
    const extracted = await extractStreamFromPage(PAGE, { fetch: fetchImpl, timeoutMs: 1000 });
    expect(extracted.url).toBe(PLAYLIST);
    expect(calls.some((url) => url.includes('/embedframe/omhufvo') || url.includes('/embedframe/'))).toBe(true);
  });

  test('worker returns the playlist JSON', async () => {
    const html = `<script>setVideoHLS("${PLAYLIST}");</script>`;
    const response = await handleWorkerRequest(workerRequest(PAGE), {}, {
      fetch: async () => ({ ok: true, status: 200, text: async () => html }),
      caches: { default: { match: async () => null, put: async () => {} } },
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.stream.url).toBe(PLAYLIST);
    expect(body.stream.type).toBe('m3u8');
    expect(body.meta.source).toBe('cloudflare');
  });
});

describe('stream fallback order', () => {
  test('stops at Cloudflare when the Worker returns a URL', async () => {
    const calls = [];
    const fetchImpl = async (url) => {
      calls.push(String(url));
      return jsonResponse(200, { success: true, stream: { url: PLAYLIST, expiresIn: 240, type: 'm3u8' } });
    };
    const resolved = await resolveStreamUrl({
      pageUrl: PAGE,
      workerBaseUrl: 'https://worker.test',
      apiBaseUrl: 'https://api.test',
      fetch: fetchImpl,
    });
    expect(resolved.source).toBe('cloudflare');
    expect(resolved.url).toBe(PLAYLIST);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain('worker.test');
  });

  test('calls AWS when the Worker fails', async () => {
    const calls = [];
    const fetchImpl = async (url) => {
      calls.push(String(url));
      if (String(url).includes('worker.test')) {
        return jsonResponse(502, { success: false, code: 'M3U8_NOT_FOUND' });
      }
      return jsonResponse(200, { success: true, stream: { url: 'https://cdn.example.com/aws.m3u8', expiresIn: 240, type: 'm3u8' } });
    };
    const resolved = await resolveStreamUrl({
      pageUrl: PAGE,
      workerBaseUrl: 'https://worker.test',
      apiBaseUrl: 'https://api.test',
      apiKey: 'secret',
      fetch: fetchImpl,
    });
    expect(resolved.source).toBe('aws');
    expect(resolved.url).toBe('https://cdn.example.com/aws.m3u8');
    expect(calls[1]).toContain('https://api.test/stream?url=');
  });

  test('skips Cloudflare after the player rejects that URL', async () => {
    const calls = [];
    const fetchImpl = async (url) => {
      calls.push(String(url));
      return jsonResponse(200, { success: true, stream: { url: 'https://cdn.example.com/aws.m3u8', expiresIn: 100, type: 'm3u8' } });
    };
    const resolved = await resolveStreamUrl({
      pageUrl: PAGE,
      workerBaseUrl: 'https://worker.test',
      apiBaseUrl: 'https://api.test',
      skipCloudflare: true,
      fetch: fetchImpl,
    });
    expect(resolved.source).toBe('aws');
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain('api.test/stream');
  });
});
