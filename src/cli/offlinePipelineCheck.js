'use strict';

/**
 * Offline pipeline checks (no network scrape / no GitHub).
 */
const assert = require('assert');
const path = require('path');
const os = require('os');
const fsp = require('fs/promises');

const { CatalogProcessService } = require('../application/catalog/CatalogProcessService');
const { JsonGeneratorService, chunkItems } = require('../application/catalog/JsonGeneratorService');
const { CatalogDiffService } = require('../application/catalog/CatalogDiffService');
const { hasContentChanged } = require('../utils/jsonCompare.util');
const { parentIdFromItem } = require('../utils/parentId.util');
const { replaceDir, removeDir } = require('../utils/file.util');

async function run() {
  const processor = new CatalogProcessService();
  const items = processor.processItems([
    { title: ' B ', img: 'https://ex.com/a.jpg', url: 'https://ex.com/b' },
    { title: 'A', img: 'https://ex.com/a.jpg', url: 'https://ex.com/a' },
    { title: 'A', img: 'https://ex.com/a.jpg', url: 'https://ex.com/a' },
    { title: '', img: 'https://ex.com/x.jpg', url: 'https://ex.com/x' },
  ]);
  assert.strictEqual(items.length, 2);
  assert.strictEqual(items[0].url, 'https://ex.com/a');

  assert.strictEqual(chunkItems(new Array(250).fill(0), 100).length, 3);

  const tmp = await fsp.mkdtemp(path.join(os.tmpdir(), 'movies-pipeline-'));
  const outputDir = path.join(tmp, 'output');
  const previousDir = path.join(tmp, 'previous');

  const generator = new JsonGeneratorService({ outputDir, pageSize: 2 });
  const homeItems = [
    { title: '1', img: 'https://ex.com/1.jpg', url: 'https://ex.com/1' },
    { title: '2', img: 'https://ex.com/2.jpg', url: 'https://ex.com/2' },
    { title: '3', img: 'https://ex.com/3.jpg', url: 'https://ex.com/3' },
  ];
  const home = await generator.generateHome(homeItems);
  assert.strictEqual(home.pages, 2);

  const parent = {
    title: 'Star',
    img: 'https://ex.com/p.jpg',
    url: 'https://ex.com/model/star',
    id: parentIdFromItem({ url: 'https://ex.com/model/star', title: 'Star' }),
  };
  const children = new Map([
    [
      parent.id,
      [
        { title: 'c1', img: 'https://ex.com/c1.jpg', url: 'https://ex.com/c1' },
        { title: 'c2', img: 'https://ex.com/c2.jpg', url: 'https://ex.com/c2' },
      ],
    ],
  ]);
  const models = await generator.generateParentChild('model', [parent], children);
  assert.ok(models.files.includes('models/index.json'));
  assert.ok(models.files.some((f) => f.includes(`/page-1.json`)));

  await replaceDir(outputDir, previousDir);
  const diff1 = await new CatalogDiffService({ outputDir, previousDir }).diff();
  assert.strictEqual(diff1.changed.length, 0);

  // Change only generatedAt-equivalent by regenerating same content → should be unchanged after sanitize
  await generator.generateHome(homeItems);
  const diff2 = await new CatalogDiffService({ outputDir, previousDir }).diff();
  const homeChanged = diff2.changed.filter((c) => c.path.startsWith('home/'));
  assert.strictEqual(homeChanged.length, 0, 'volatile timestamps must not force upload');

  const a = { items: [{ title: 't', img: 'https://ex.com/i', url: 'https://ex.com/u' }], generatedAt: '1' };
  const b = { items: [{ title: 't', img: 'https://ex.com/i', url: 'https://ex.com/u' }], generatedAt: '2' };
  assert.strictEqual(hasContentChanged(a, b), false);

  await removeDir(tmp);
  process.stdout.write('offline pipeline checks passed\n');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
