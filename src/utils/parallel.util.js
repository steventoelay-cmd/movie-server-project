'use strict';

/**
 * Run async mapper over items with a concurrency limit.
 * @template T, R
 * @param {T[]} items
 * @param {number} concurrency
 * @param {(item: T, index: number) => Promise<R>} fn
 * @returns {Promise<R[]>}
 */
async function mapLimit(items, concurrency, fn) {
  const list = Array.isArray(items) ? items : [];
  const limit = Math.max(1, concurrency || 1);
  const results = new Array(list.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < list.length) {
      const i = nextIndex;
      nextIndex += 1;
      results[i] = await fn(list[i], i);
    }
  }

  const workers = Array.from({ length: Math.min(limit, list.length || 1) }, () => worker());
  await Promise.all(workers);
  return results;
}

module.exports = { mapLimit };
