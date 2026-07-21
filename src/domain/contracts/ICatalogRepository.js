/**
 * Future catalog / metadata repository contract.
 *
 * Today: JsonGeneratorService + GitHub JSON files fulfill listing reads (via CDN).
 * Tomorrow: Postgres/MySQL/Mongo adapter behind the same methods.
 *
 * Application services should call a repository — not SQL/drivers directly.
 *
 * @typedef {object} CatalogListQuery
 * @property {string} section - home | model | channel | tag
 * @property {number} [page]
 * @property {number} [limit]
 * @property {string} [parentId]
 *
 * @typedef {object} ICatalogRepository
 * @property {(q: CatalogListQuery) => Promise<{ items: object[], page: number, hasNext?: boolean }>} listItems
 * @property {(parent: object) => Promise<object[]>} [listChildren]
 * @property {(doc: object) => Promise<void>} [upsertPage]
 */

'use strict';

const ICATALOG_REPOSITORY_METHODS = Object.freeze(['listItems']);

function isCatalogRepository(repo) {
  return Boolean(repo && typeof repo.listItems === 'function');
}

module.exports = {
  ICATALOG_REPOSITORY_METHODS,
  isCatalogRepository,
};
