'use strict';

const os = require('os');
const path = require('path');
const fsp = require('fs/promises');
const { CatalogLoadService } = require('../../src/application/catalog/CatalogLoadService');
const { JsonGeneratorService, buildDocument } = require('../../src/application/catalog/JsonGeneratorService');
const {
  sectionFromFolder,
  isValidParentId,
  parsePageNumber,
} = require('../../src/utils/catalogFolder.util');

describe('catalogFolder.util', () => {
  test('maps Flutter folder names to sections', () => {
    expect(sectionFromFolder('home')).toBe('home');
    expect(sectionFromFolder('myanmar')).toBe('myanmar');
    expect(sectionFromFolder('models')).toBe('model');
    expect(sectionFromFolder('channels')).toBe('channel');
    expect(sectionFromFolder('tags')).toBe('tag');
    expect(sectionFromFolder('unknown')).toBeNull();
  });

  test('validates parent ids', () => {
    expect(isValidParentId('star-abc1234567')).toBe(true);
    expect(isValidParentId('../etc')).toBe(false);
    expect(isValidParentId('')).toBe(false);
  });

  test('parsePageNumber bounds', () => {
    expect(parsePageNumber('1')).toBe(1);
    expect(parsePageNumber('0')).toBeNull();
    expect(parsePageNumber('abc')).toBeNull();
  });
});

describe('CatalogLoadService + Flutter CDN paths', () => {
  let tmpDir;

  beforeEach(async () => {
    tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'catalog-load-'));
  });

  afterEach(async () => {
    await fsp.rm(tmpDir, { recursive: true, force: true });
  });

  test('serves home/page-2.json from output', async () => {
    const generator = new JsonGeneratorService({ outputDir: tmpDir, pageSize: 2 });
    const items = [
      { title: 'A', img: 'https://cdn/a.jpg', url: 'https://www.xvideos.com/video1' },
      { title: 'B', img: 'https://cdn/b.jpg', url: 'https://www.xvideos.com/video2' },
      { title: 'C', img: 'https://cdn/c.jpg', url: 'https://www.xvideos.com/video3' },
    ];
    await generator.generateHome(items);

    const service = new CatalogLoadService({ outputDir: tmpDir });
    const doc = await service.getPage({ section: 'home', page: 2 });
    expect(doc.section).toBe('home');
    expect(doc.page).toBe(2);
    expect(doc.items).toHaveLength(1);
    expect(doc.items[0].id).toMatch(/^[a-f0-9]{16}$/);
    expect(doc.hasNext).toBe(false);
  });

  test('normalizeSection accepts Flutter folder aliases', async () => {
    const service = new CatalogLoadService({ outputDir: tmpDir });
    const doc = buildDocument({
      section: 'model',
      page: 1,
      items: [],
      extraMeta: { kind: 'index', parentCount: 0 },
      hasNext: false,
    });
    const rel = 'models/index.json';
    await fsp.mkdir(path.join(tmpDir, 'models'), { recursive: true });
    await fsp.writeFile(path.join(tmpDir, rel), JSON.stringify(doc));

    const loaded = await service.getPage({
      section: 'models',
      page: 1,
      parentIndex: true,
    });
    expect(loaded.section).toBe('model');
  });
});
