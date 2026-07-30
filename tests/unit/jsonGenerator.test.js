'use strict';

const path = require('path');
const os = require('os');
const fsp = require('fs/promises');
const {
  JsonGeneratorService,
  chunkItems,
  buildDocument,
} = require('../../src/application/catalog/JsonGeneratorService');
const { CatalogProcessService } = require('../../src/application/catalog/CatalogProcessService');
const { parentIdFromItem } = require('../../src/utils/parentId.util');
const { removeDir } = require('../../src/utils/file.util');
const { makeItems } = require('../helpers/fixtures');

describe('CatalogProcessService + JsonGeneratorService', () => {
  test('processItems dedupes and drops invalid', () => {
    const processor = new CatalogProcessService();
    const items = processor.processItems([
      { title: ' B ', img: 'https://ex.com/a.jpg', url: 'https://ex.com/b' },
      { title: 'A', img: 'https://ex.com/a.jpg', url: 'https://ex.com/a' },
      { title: 'A', img: 'https://ex.com/a.jpg', url: 'https://ex.com/a' },
      { title: '', img: 'https://ex.com/x.jpg', url: 'https://ex.com/x' },
    ]);
    expect(items).toHaveLength(2);
    expect(items[0].url).toBe('https://ex.com/a');
  });

  test('chunkItems paginates', () => {
    expect(chunkItems(new Array(250).fill(0), 100)).toHaveLength(3);
    expect(chunkItems([], 100)).toHaveLength(1);
  });

  test('buildDocument schema fields include id and strips extras', () => {
    const doc = buildDocument({
      section: 'home',
      page: 1,
      items: [{ title: 't', img: 'https://i', url: 'https://u', extra: 'drop' }],
    });
    expect(doc.schemaVersion).toBeDefined();
    expect(doc.generatorVersion).toBeDefined();
    expect(doc.page).toBe(1);
    expect(doc.items[0].title).toBe('t');
    expect(doc.items[0].img).toBe('https://i');
    expect(doc.items[0].url).toBe('https://u');
    expect(doc.items[0].id).toMatch(/^[a-f0-9]{16}$/);
    expect(doc.items[0]).not.toHaveProperty('extra');
    expect(doc.items[0]).not.toHaveProperty('m3u8');
    expect(doc.hasNext).toBe(false);
  });

  test('buildDocument sets hasNext when requested', () => {
    const doc = buildDocument({
      section: 'home',
      page: 1,
      items: [{ title: 't', img: 'https://i', url: 'https://u' }],
      hasNext: true,
    });
    expect(doc.hasNext).toBe(true);
  });

  test('generateHome writes paginated files and empty list still produces page-1', async () => {
    const tmp = await fsp.mkdtemp(path.join(os.tmpdir(), 'jest-json-'));
    try {
      const generator = new JsonGeneratorService({
        outputDir: tmp,
        pageSize: 2,
        skipUnchanged: false,
      });
      const home = await generator.generateHome(makeItems(3));
      expect(home.pages).toBe(2);

      const page1 = JSON.parse(await fsp.readFile(path.join(tmp, 'home', 'page-1.json'), 'utf8'));
      expect(page1.items).toHaveLength(2);
      expect(page1.totalItems).toBe(2);
      expect(page1.section).toBe('home');

      const empty = await generator.generateHome([]);
      expect(empty.pages).toBe(1);
      const emptyDoc = JSON.parse(await fsp.readFile(path.join(tmp, 'home', 'page-1.json'), 'utf8'));
      expect(emptyDoc.items).toEqual([]);
    } finally {
      await removeDir(tmp);
    }
  });

  test('tag parent index omits img (title + url only)', async () => {
    const tmp = await fsp.mkdtemp(path.join(os.tmpdir(), 'jest-json-tag-'));
    try {
      const generator = new JsonGeneratorService({
        outputDir: tmp,
        pageSize: 10,
        skipUnchanged: false,
      });
      const parent = {
        title: 'amateur',
        img: 'https://ex.com/should-not-appear.jpg',
        url: 'https://www.xvideos.com/tags/amateur',
        id: parentIdFromItem({ url: 'https://www.xvideos.com/tags/amateur', title: 'amateur' }),
      };
      const children = new Map([[parent.id, makeItems(1, 'https://ex.com/v')]]);
      await generator.generateParentChild('tag', [parent], children);
      const index = JSON.parse(await fsp.readFile(path.join(tmp, 'tags', 'index.json'), 'utf8'));
      expect(index.items[0].title).toBe('amateur');
      expect(index.items[0].url).toBe('https://www.xvideos.com/tags/amateur');
      expect(index.items[0].id).toMatch(/^[a-f0-9]{16}$/);
      expect(index.items[0]).not.toHaveProperty('img');
    } finally {
      await removeDir(tmp);
    }
  });

  test('generateParentChild writes index + children pages', async () => {
    const tmp = await fsp.mkdtemp(path.join(os.tmpdir(), 'jest-json-pc-'));
    try {
      const generator = new JsonGeneratorService({
        outputDir: tmp,
        pageSize: 10,
        skipUnchanged: false,
      });
      const parent = {
        title: 'Star',
        img: 'https://ex.com/p.jpg',
        url: 'https://ex.com/model/star',
        id: parentIdFromItem({ url: 'https://ex.com/model/star', title: 'Star' }),
      };
      const children = new Map([[parent.id, makeItems(2, 'https://ex.com/c')]]);
      const models = await generator.generateParentChild('model', [parent], children);
      expect(models.files).toContain('models/index.json');
      expect(models.files.some((f) => f.includes('/page-1.json'))).toBe(true);
    } finally {
      await removeDir(tmp);
    }
  });
});
