'use strict';

const path = require('path');
const os = require('os');
const { performance } = require('perf_hooks');
const request = require('supertest');
const { JsonGeneratorService } = require('../../src/application/catalog/JsonGeneratorService');
const { CatalogProcessService } = require('../../src/application/catalog/CatalogProcessService');
const { createMockedApp, defaultDetail, defaultStream } = require('../helpers/createTestApp');
const { removeDir } = require('../../src/utils/file.util');
const { getMemoryStats } = require('../../src/utils/memory.util');
const { makeItems } = require('../helpers/fixtures');

/**
 * Opt-in load suite: npm run test:load  (or TEST_LOAD=1 npm test)
 */
describe('Load / performance (50k+ scale)', () => {
  test('JSON generation for 50,000 items stays bounded', async () => {
    const tmp = path.join(os.tmpdir(), `jest-load-${Date.now()}`);
    const items = makeItems(50_000);
    const generator = new JsonGeneratorService({
      outputDir: tmp,
      pageSize: 100,
      skipUnchanged: false,
    });

    const before = getMemoryStats();
    const t0 = performance.now();
    const result = await generator.generateHome(items);
    const elapsedMs = performance.now() - t0;
    const after = getMemoryStats();

    expect(result.pages).toBe(500);
    expect(elapsedMs).toBeLessThan(120_000);
    expect(after.heapUsedMB).toBeGreaterThan(0);

    // eslint-disable-next-line no-console
    console.log(
      `[load] 50k JSON gen: ${elapsedMs.toFixed(0)}ms, pages=${result.pages}, heap ${before.heapUsedMB}→${after.heapUsedMB}MB`,
    );

    await removeDir(tmp);
  }, 180_000);

  test('processItems scales for large input', () => {
    const processor = new CatalogProcessService();
    const raw = makeItems(10_000);
    raw.push(...makeItems(1000)); // duplicates
    const t0 = performance.now();
    const items = processor.processItems(raw);
    const elapsedMs = performance.now() - t0;
    expect(items.length).toBe(10_000);
    expect(elapsedMs).toBeLessThan(15_000);
  }, 30_000);

  test('concurrent detail + stream requests', async () => {
    const getDetail = jest.fn(async () => ({
      ...defaultDetail(),
      _meta: { cacheHit: true, durationMs: 1 },
    }));
    const getStream = jest.fn(async () => ({
      ...defaultStream(),
      cache: { hit: true, age: 10, stale: false },
    }));
    const { app } = createMockedApp({ getDetail, getStream });
    const url = 'https://www.tubev.sex/watch/load';

    const t0 = performance.now();
    const results = await Promise.all([
      ...Array.from({ length: 40 }, () => request(app).get('/detail').query({ url })),
      ...Array.from({ length: 40 }, () => request(app).get('/stream').query({ url })),
    ]);
    const elapsedMs = performance.now() - t0;

    expect(results.every((r) => r.status === 200)).toBe(true);
    expect(elapsedMs).toBeLessThan(30_000);
  }, 60_000);
});
