'use strict';

const assert = require('assert');
const { parseList } = require('../scrapers/parsers/parseList');
const { normalizeVideoList } = require('../scrapers/normalizers/videoItem.normalizer');
const { createScraperEngine, SECTIONS } = require('../scrapers');
const { withRetry, isRetryableError } = require('../utils/retry.util');
const { buildPaginatedUrl } = require('../scrapers/core/pagination');

async function run() {
  const html = `
    <div class="v"><a href="/watch/1" title="One"><img src="/i1.jpg"/></a></div>
    <div class="v"><a href="/watch/1" title="Dup"><img src="/i1.jpg"/></a></div>
    <div class="v"><a href="/watch/2" title=""><img src="/i2.jpg"/></a></div>
    <div class="v"><a href="/watch/3" title="Three"><img src="/i3.jpg"/></a></div>
  `;

  const raw = parseList(
    html,
    {
      selectors: { item: '.v', title: 'a', image: 'img', url: 'a' },
      attributes: { title: 'attr:title', image: 'attr:src', url: 'attr:href' },
    },
    'https://ex.com',
  );

  const { items, dropped, duplicates } = normalizeVideoList(raw);
  assert.strictEqual(items.length, 2);
  assert.strictEqual(duplicates, 1);
  assert.ok(dropped >= 1);
  assert.strictEqual(items[0].url, 'https://ex.com/watch/1');
  assert.strictEqual(items[1].title, 'Three');

  const page2 = buildPaginatedUrl('https://ex.com/videos', 2, {
    type: 'query',
    pattern: '?p={page}',
    omitFirstPage: true,
  });
  assert.strictEqual(page2, 'https://ex.com/videos?p=2');

  const err = Object.assign(new Error('fail'), { response: { status: 404 } });
  assert.strictEqual(isRetryableError(err), false);

  let attempts = 0;
  await withRetry(
    async () => {
      attempts += 1;
      if (attempts < 2) {
        const e = new Error('temp');
        e.code = 'ETIMEDOUT';
        throw e;
      }
      return 'ok';
    },
    { retries: 2, baseMs: 1 },
  );
  assert.strictEqual(attempts, 2);

  const engine = createScraperEngine();
  assert.deepStrictEqual(engine.listSites().sort(), ['xvideos']);
  assert.ok(Object.values(SECTIONS).includes('home'));

  process.stdout.write('offline scraper checks passed\n');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
