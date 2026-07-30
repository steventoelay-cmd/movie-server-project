'use strict';

const path = require('path');
const os = require('os');
const fsp = require('fs/promises');
const { CatalogProcessService } = require('../../src/application/catalog/CatalogProcessService');
const { JsonGeneratorService } = require('../../src/application/catalog/JsonGeneratorService');
const { CatalogDiffService } = require('../../src/application/catalog/CatalogDiffService');
const { parseDetail } = require('../../src/scrapers/parsers/parseDetail');
const { normalizeDetail } = require('../../src/scrapers/normalizers/detail.normalizer');
const { parseStream } = require('../../src/scrapers/parsers/parseStream');
const { DEFAULT_STREAM_EXTRACTION } = require('../../src/scrapers/parsers/streamDefaults');
const { shapeResponse } = require('../../src/application/detail/DetailService');
const { buildSuccessResponse } = require('../../src/application/stream/StreamService');
const { validateStreamUrl } = require('../../src/utils/stream.validator');
const { replaceDir, removeDir } = require('../../src/utils/file.util');
const { loadHtml, DETAIL_CONFIG, SAMPLE_PAGE_URL, makeItems } = require('../helpers/fixtures');

describe('Integration: catalog pipeline (offline)', () => {
  test('scrape-like raw → normalize → JSON → compare → sync candidates', async () => {
    const tmp = await fsp.mkdtemp(path.join(os.tmpdir(), 'jest-pipeline-'));
    const outputDir = path.join(tmp, 'output');
    const previousDir = path.join(tmp, 'previous');

    try {
      const processor = new CatalogProcessService();
      const raw = [
        { title: ' One ', img: 'https://cdn.example.com/1.jpg', url: 'https://www.tubev.sex/watch/1' },
        { title: 'Two', img: 'https://cdn.example.com/2.jpg', url: 'https://www.tubev.sex/watch/2' },
        { title: 'One', img: 'https://cdn.example.com/1.jpg', url: 'https://www.tubev.sex/watch/1/' },
      ];
      const items = processor.processItems(raw, { section: 'home', siteId: 'tubev' });
      expect(items).toHaveLength(2);

      const generator = new JsonGeneratorService({
        outputDir,
        pageSize: 1,
        skipUnchanged: false,
      });
      await generator.generateHome(items);

      await replaceDir(outputDir, previousDir);
      const unchanged = await new CatalogDiffService({ outputDir, previousDir }).diff();
      expect(unchanged.changed).toHaveLength(0);

      // Simulate "GitHub sync candidates" = changed only
      await generator.generateHome([...items, ...makeItems(1).map((i) => ({ ...i, title: 'Extra' }))]);
      const diff = await new CatalogDiffService({ outputDir, previousDir }).diff();
      expect(diff.changed.length).toBeGreaterThan(0);
      // Sync would upload diff.changed only — never stream URLs
      for (const file of diff.changed) {
        const text = JSON.stringify(file.content);
        expect(text).not.toMatch(/\.m3u8/);
      }
    } finally {
      await removeDir(tmp);
    }
  });
});

describe('Integration: detail → related → stream (offline fixtures)', () => {
  test('video HTML → detail/related → stream m3u8 response', () => {
    const raw = parseDetail(loadHtml('detail-normal.html'), DETAIL_CONFIG, SAMPLE_PAGE_URL);
    const detail = normalizeDetail(raw, SAMPLE_PAGE_URL);
    const shaped = shapeResponse(detail);

    expect(shaped.title).toBe('Sample Video');
    expect(shaped.id).toMatch(/^[a-f0-9]{16}$/);
    expect(shaped.related.length).toBe(1);
    expect(shaped.related[0].id).toMatch(/^[a-f0-9]{16}$/);
    expect(shaped).not.toHaveProperty('m3u8');

    const streamParsed = parseStream(
      loadHtml('stream-normal.html'),
      DEFAULT_STREAM_EXTRACTION,
      SAMPLE_PAGE_URL,
    );
    expect(streamParsed.m3u8).toBeTruthy();
    expect(validateStreamUrl(streamParsed.m3u8).valid).toBe(true);

    const body = buildSuccessResponse({
      streamUrl: streamParsed.m3u8,
      expiresIn: 300,
      cacheHit: false,
      age: 0,
      siteId: 'tubev',
      payload: { qualities: [], mirrors: [], subtitles: [], audioTracks: [], drm: null },
      durationMs: 10,
      retries: 0,
    });

    expect(body.success).toBe(true);
    expect(body.stream.url).toContain('.m3u8');
    expect(body.stream.expiresIn).toBe(300);
  });
});
