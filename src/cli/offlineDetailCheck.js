'use strict';

/**
 * Offline Detail + Related checks (no network).
 */
const assert = require('assert');
const path = require('path');
const os = require('os');
const { parseDetail } = require('../scrapers/parsers/parseDetail');
const { normalizeDetail } = require('../scrapers/normalizers/detail.normalizer');
const { DetailCache } = require('../infrastructure/cache/DetailCache');
const { PromiseLock } = require('../infrastructure/concurrency/PromiseLock');
const { shapeResponse } = require('../application/detail/DetailService');
const { removeDir } = require('../utils/file.util');

async function run() {
  const html = `
    <html><head>
      <meta property="og:title" content="Sample Video" />
      <meta property="og:image" content="/poster.jpg" />
      <meta property="og:description" content="A description" />
    </head><body>
      <h1>Sample Video</h1>
      <div class="duration">12:34</div>
      <div class="tags"><a class="tag">Action</a><a class="tag">Drama</a></div>
      <div id="related_video_block">
        <figure class="drop-label_else">
          <a class="i tur" href="/v/1" title="Rel One"><img src="/r1.jpg"/></a>
        </figure>
        <figure class="drop-label_else">
          <a class="i tur" href="/v/1" title="Dup"><img src="/r1.jpg"/></a>
        </figure>
        <figure class="drop-label_else">
          <a class="i tur" href="/watch/sample" title="Self"><img src="/self.jpg"/></a>
        </figure>
      </div>
    </body></html>
  `;

  const detailConfig = {
    fields: {
      title: { selector: 'h1', attribute: 'text' },
      image: { selector: 'meta[property="og:image"]', attribute: 'attr:content' },
      description: { selector: 'meta[property="og:description"]', attribute: 'attr:content' },
      duration: { selector: '.duration', attribute: 'text' },
      tags: { item: 'a.tag', attribute: 'text' },
    },
    related: {
      selectors: {
        item: '#related_video_block figure.drop-label_else',
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
  };

  const pageUrl = 'https://www.tubev.sex/watch/sample';
  const raw = parseDetail(html, detailConfig, pageUrl);
  assert.strictEqual(raw.title, 'Sample Video');
  assert.ok(raw.img.includes('poster.jpg'));
  assert.strictEqual(raw.description, 'A description');
  assert.strictEqual(raw.duration, '12:34');
  assert.deepStrictEqual(raw.tags, ['Action', 'Drama']);

  const detail = normalizeDetail(raw, pageUrl);
  assert.strictEqual(detail.related.length, 1);
  assert.strictEqual(detail.related[0].title, 'Rel One');
  assert.ok(!detail.related.some((r) => r.url.includes('/watch/sample')));
  assert.ok(Array.isArray(detail.metadata.subtitles));
  assert.strictEqual(detail.metadata.locale, null);

  const shaped = shapeResponse(detail);
  assert.ok(shaped.related[0].title);
  assert.ok(!('m3u8' in shaped));

  const tmp = path.join(os.tmpdir(), `detail-cache-${Date.now()}`);
  const cache = new DetailCache({ dir: tmp, ttlMs: 60_000, maxEntries: 10 });
  await cache.set(pageUrl, detail);
  const hit = await cache.get(pageUrl);
  assert.strictEqual(hit.hit, true);
  assert.strictEqual(hit.entry.payload.title, 'Sample Video');

  // PromiseLock single-flight
  const lock = new PromiseLock();
  let runs = 0;
  const tasks = Array.from({ length: 5 }, () =>
    lock.run('same', async () => {
      runs += 1;
      await new Promise((r) => setTimeout(r, 20));
      return 'ok';
    }),
  );
  const results = await Promise.all(tasks);
  assert.strictEqual(runs, 1);
  assert.deepStrictEqual(results, ['ok', 'ok', 'ok', 'ok', 'ok']);

  await removeDir(tmp);
  process.stdout.write('offline detail checks passed\n');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
