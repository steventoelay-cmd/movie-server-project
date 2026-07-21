'use strict';

const path = require('path');
const os = require('os');
const { DetailCache } = require('../../src/infrastructure/cache/DetailCache');
const { StreamCache } = require('../../src/infrastructure/cache/StreamCache');
const { PromiseLock } = require('../../src/infrastructure/concurrency/PromiseLock');
const { MemoryStore } = require('../../src/infrastructure/cache/base/MemoryStore');
const { removeDir } = require('../../src/utils/file.util');

describe('Cache + PromiseLock', () => {
  test('DetailCache hit / miss / expiration / cleanup', async () => {
    const tmp = path.join(os.tmpdir(), `detail-cache-${Date.now()}`);
    const cache = new DetailCache({ dir: tmp, ttlMs: 50, maxEntries: 10 });
    const url = 'https://www.tubev.sex/watch/cache-1';

    expect((await cache.get(url)).hit).toBe(false);

    await cache.set(url, {
      schemaVersion: 1,
      title: 'T',
      img: '',
      description: '',
      metadata: {},
      related: [],
    });
    expect((await cache.get(url)).hit).toBe(true);

    await new Promise((r) => setTimeout(r, 80));
    expect((await cache.get(url)).hit).toBe(false);

    await cache.set(url, {
      schemaVersion: 1,
      title: 'T2',
      img: '',
      description: '',
      metadata: {},
      related: [],
    });
    const cleaned = await cache.cleanup();
    expect(cleaned).toEqual(
      expect.objectContaining({
        memRemoved: expect.any(Number),
        fileRemoved: expect.any(Number),
      }),
    );

    await removeDir(tmp);
  });

  test('StreamCache hit and stale grace path', async () => {
    const tmp = path.join(os.tmpdir(), `stream-cache-${Date.now()}`);
    const cache = new StreamCache({ dir: tmp, ttlMs: 40, graceMs: 5000, maxEntries: 10 });
    const url = 'https://www.tubev.sex/watch/stream-1';

    await cache.set(url, { url: 'https://cdn.example.com/a.m3u8', type: 'm3u8' });
    const hit = await cache.get(url);
    expect(hit.hit).toBe(true);
    expect(hit.entry.m3u8).toContain('.m3u8');

    await new Promise((r) => setTimeout(r, 60));
    const stale = await cache.get(url, { allowStale: true });
    expect(stale.hit).toBe(true);
    expect(stale.stale).toBe(true);

    await removeDir(tmp);
  });

  test('PromiseLock single-flight', async () => {
    const lock = new PromiseLock();
    let runs = 0;
    const tasks = Array.from({ length: 20 }, () =>
      lock.run('same', async () => {
        runs += 1;
        await new Promise((r) => setTimeout(r, 30));
        return 'ok';
      }),
    );
    const results = await Promise.all(tasks);
    expect(runs).toBe(1);
    expect(results).toHaveLength(20);
    expect(results.every((r) => r === 'ok')).toBe(true);
  });

  test('MemoryStore cleanup removes expired', () => {
    const store = new MemoryStore({ maxEntries: 10 });
    store.set('a', 1, 1);
    const removed = store.cleanup();
    expect(removed).toBeGreaterThanOrEqual(0);
    // force expire
    store.set('b', 2, 1);
    const entry = store._map.get('b');
    entry.expiresAt = Date.now() - 1;
    expect(store.cleanup()).toBeGreaterThanOrEqual(1);
  });
});
