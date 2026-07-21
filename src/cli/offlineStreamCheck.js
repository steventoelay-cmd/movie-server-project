'use strict';

/**
 * Offline Stream API checks (no network).
 */
const assert = require('assert');
const path = require('path');
const os = require('os');
const { parseStream } = require('../scrapers/parsers/parseStream');
const { validateStreamUrl } = require('../utils/stream.validator');
const { StreamCache } = require('../infrastructure/cache/StreamCache');
const { PromiseLock } = require('../infrastructure/concurrency/PromiseLock');
const { buildSuccessResponse } = require('../application/stream/StreamService');
const { removeDir } = require('../utils/file.util');

async function run() {
  const html = `
    <html><body>
      <script>var hlsUrl = "https://cdn.example.com/v/play.m3u8?token=abc";</script>
      <video><source src="https://cdn.example.com/v/legacy.mp4" type="video/mp4"/></video>
    </body></html>
  `;

  const parsed = parseStream(
    html,
    {
      videoExtraction: {
        scriptM3u8Patterns: [/hlsUrl\s*=\s*["']([^"']+)["']/i],
        followIframe: false,
      },
    },
    'https://www.tubev.sex/watch/1',
  );
  assert.ok(parsed.m3u8.includes('.m3u8'));

  assert.strictEqual(validateStreamUrl('').valid, false);
  assert.strictEqual(validateStreamUrl('not-a-url').valid, false);
  assert.strictEqual(validateStreamUrl('https://x.com/a.mp4', { requireM3u8: true }).valid, false);
  assert.strictEqual(validateStreamUrl(parsed.m3u8).valid, true);

  const expired = `https://cdn.example.com/a.m3u8?expires=${Math.floor(Date.now() / 1000) - 60}`;
  assert.strictEqual(validateStreamUrl(expired).reason, 'expired_url');

  const tmp = path.join(os.tmpdir(), `stream-cache-${Date.now()}`);
  const cache = new StreamCache({ dir: tmp, ttlMs: 60_000, graceMs: 120_000 });
  const pageUrl = 'https://www.tubev.sex/watch/demo';
  await cache.set(pageUrl, {
    url: parsed.m3u8,
    type: 'm3u8',
    validationStatus: 'valid',
    qualities: [],
    mirrors: [],
    subtitles: [],
    audioTracks: [],
    drm: null,
  });
  const hit = await cache.get(pageUrl);
  assert.strictEqual(hit.hit, true);
  assert.strictEqual(hit.entry.m3u8, parsed.m3u8);

  const lock = new PromiseLock();
  let runs = 0;
  const results = await Promise.all(
    Array.from({ length: 20 }, () =>
      lock.run('stream:same', async () => {
        runs += 1;
        await new Promise((r) => setTimeout(r, 15));
        return 'm3u8';
      }),
    ),
  );
  assert.strictEqual(runs, 1);
  assert.strictEqual(results.length, 20);

  const body = buildSuccessResponse({
    streamUrl: parsed.m3u8,
    expiresIn: 300,
    cacheHit: true,
    age: 120,
    payload: { qualities: [], mirrors: [], subtitles: [], audioTracks: [], drm: null, adaptive: true },
    durationMs: 5,
    retries: 0,
  });
  assert.strictEqual(body.success, true);
  assert.strictEqual(body.stream.url, parsed.m3u8);
  assert.strictEqual(body.cache.hit, true);
  assert.strictEqual(body.cache.age, 120);
  assert.ok(Array.isArray(body.stream.qualities));

  await removeDir(tmp);
  process.stdout.write('offline stream checks passed\n');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
