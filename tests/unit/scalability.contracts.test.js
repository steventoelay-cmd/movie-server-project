'use strict';

const { MemoryStore } = require('../../src/infrastructure/cache/base/MemoryStore');
const { isCacheStore } = require('../../src/infrastructure/cache/base/ICacheStore');
const { isCatalogRepository } = require('../../src/domain/contracts/ICatalogRepository');
const { isObjectStorage } = require('../../src/domain/contracts/IObjectStorage');
const { isJobQueue } = require('../../src/domain/contracts/IJobQueue');

describe('scalability contracts', () => {
  test('MemoryStore satisfies ICacheStore', () => {
    expect(isCacheStore(new MemoryStore({ maxEntries: 10 }))).toBe(true);
    expect(isCacheStore({})).toBe(false);
  });

  test('duck-type helpers reject incomplete adapters', () => {
    expect(isCatalogRepository({ listItems: async () => ({ items: [] }) })).toBe(true);
    expect(isCatalogRepository({})).toBe(false);
    expect(isObjectStorage({ putObjects: async () => ({ uploaded: [] }) })).toBe(true);
    expect(isJobQueue({ enqueue: async () => ({ id: '1' }), process() {} })).toBe(true);
  });
});
