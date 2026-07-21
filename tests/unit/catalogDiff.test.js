'use strict';

const path = require('path');
const os = require('os');
const fsp = require('fs/promises');
const { CatalogDiffService } = require('../../src/application/catalog/CatalogDiffService');
const { JsonGeneratorService } = require('../../src/application/catalog/JsonGeneratorService');
const { hasContentChanged, sanitizeForCompare } = require('../../src/utils/jsonCompare.util');
const { replaceDir, removeDir, writeJsonFile } = require('../../src/utils/file.util');
const { makeItems } = require('../helpers/fixtures');

describe('CatalogDiffService / jsonCompare', () => {
  test('ignores volatile timestamps', () => {
    const a = {
      items: [{ title: 't', img: 'https://ex.com/i', url: 'https://ex.com/u' }],
      generatedAt: '1',
      lastUpdate: '1',
    };
    const b = { ...a, generatedAt: '2', lastUpdate: '2' };
    expect(hasContentChanged(a, b)).toBe(false);
    expect(sanitizeForCompare(a).generatedAt).toBeUndefined();
  });

  test('detects real content change', () => {
    const a = { items: [{ title: 't', img: 'i', url: 'u' }] };
    const b = { items: [{ title: 't2', img: 'i', url: 'u' }] };
    expect(hasContentChanged(a, b)).toBe(true);
  });

  test('diff reports unchanged then changed', async () => {
    const tmp = await fsp.mkdtemp(path.join(os.tmpdir(), 'jest-diff-'));
    const outputDir = path.join(tmp, 'output');
    const previousDir = path.join(tmp, 'previous');
    try {
      const items = makeItems(3);
      const generator = new JsonGeneratorService({
        outputDir,
        pageSize: 2,
        skipUnchanged: false,
      });
      await generator.generateHome(items);
      await replaceDir(outputDir, previousDir);

      const diff1 = await new CatalogDiffService({ outputDir, previousDir }).diff();
      expect(diff1.changed).toHaveLength(0);

      await generator.generateHome([
        ...items,
        { title: 'new', img: 'https://cdn.example.com/n.jpg', url: 'https://www.tubev.sex/watch/new' },
      ]);
      const diff2 = await new CatalogDiffService({ outputDir, previousDir }).diff();
      expect(diff2.changed.length).toBeGreaterThan(0);
    } finally {
      await removeDir(tmp);
    }
  });

  test('compares large JSON without throwing', async () => {
    const tmp = await fsp.mkdtemp(path.join(os.tmpdir(), 'jest-diff-large-'));
    try {
      const large = {
        items: makeItems(5000),
        generatedAt: new Date().toISOString(),
      };
      await writeJsonFile(path.join(tmp, 'a.json'), large);
      await writeJsonFile(path.join(tmp, 'b.json'), {
        ...large,
        generatedAt: new Date().toISOString(),
      });
      const a = JSON.parse(await fsp.readFile(path.join(tmp, 'a.json'), 'utf8'));
      const b = JSON.parse(await fsp.readFile(path.join(tmp, 'b.json'), 'utf8'));
      expect(hasContentChanged(a, b)).toBe(false);
    } finally {
      await removeDir(tmp);
    }
  });
});
