'use strict';

/**
 * Offline performance-layer checks (no network).
 */
const assert = require('assert');
const { mapLimit } = require('../utils/parallel.util');
const { HtmlPageCache } = require('../infrastructure/cache/HtmlPageCache');
const { RequestQueue } = require('../infrastructure/concurrency/RequestQueue');
const { MetricsCollector } = require('../infrastructure/metrics/MetricsCollector');
const { getMemoryStats } = require('../utils/memory.util');
const { ConcurrencyPool } = require('../infrastructure/concurrency/ConcurrencyPool');

async function run() {
  const order = [];
  const mapped = await mapLimit([1, 2, 3, 4, 5], 2, async (n) => {
    order.push(n);
    await new Promise((r) => setTimeout(r, 10));
    return n * 2;
  });
  assert.deepStrictEqual(mapped, [2, 4, 6, 8, 10]);

  let loads = 0;
  const htmlCache = new HtmlPageCache({
    enabled: true,
    ttlMs: 60_000,
    maxEntries: 50,
    metrics: new MetricsCollector(),
  });
  const html = await htmlCache.getOrLoad('https://ex.com/a', async () => {
    loads += 1;
    return '<html>ok</html>';
  });
  const html2 = await htmlCache.getOrLoad('https://ex.com/a', async () => {
    loads += 1;
    return '<html>again</html>';
  });
  assert.strictEqual(html, html2);
  assert.strictEqual(loads, 1);

  // Concurrent single-flight
  loads = 0;
  const cache2 = new HtmlPageCache({ enabled: true, ttlMs: 60_000, metrics: new MetricsCollector() });
  await Promise.all(
    Array.from({ length: 10 }, () =>
      cache2.getOrLoad('https://ex.com/b', async () => {
        loads += 1;
        await new Promise((r) => setTimeout(r, 20));
        return '<html>b</html>';
      }),
    ),
  );
  assert.strictEqual(loads, 1);

  const q = new RequestQueue({ maxConcurrency: 2, intervalMs: 0 });
  let active = 0;
  let maxActive = 0;
  await Promise.all(
    Array.from({ length: 6 }, (_, i) =>
      q.schedule(async () => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        await new Promise((r) => setTimeout(r, 15));
        active -= 1;
        return i;
      }),
    ),
  );
  assert.ok(maxActive <= 2);

  const pool = new ConcurrencyPool(2);
  maxActive = 0;
  active = 0;
  await Promise.all(
    Array.from({ length: 5 }, () =>
      pool.run(async () => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        await new Promise((r) => setTimeout(r, 10));
        active -= 1;
      }),
    ),
  );
  assert.ok(maxActive <= 2);

  const mem = getMemoryStats();
  assert.ok(mem.heapUsedMB > 0);

  const metrics = new MetricsCollector();
  metrics.incr('x');
  await metrics.timeAsync('t', async () => delay(5));
  const snap = metrics.snapshot();
  assert.strictEqual(snap.counters.x, 1);
  assert.ok(snap.timings.t.count === 1);

  process.stdout.write('offline performance checks passed\n');
}

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
