'use strict';

const { stripTrailingSlash } = require('../../utils/url.util');

/**
 * Build a paginated URL from base + pagination config.
 *
 * @param {string} baseUrl
 * @param {number} page
 * @param {object} [pagination]
 * @returns {string}
 */
function buildPaginatedUrl(baseUrl, page = 1, pagination = {}) {
  const startPage = pagination.startPage ?? 1;
  const omitFirstPage = pagination.omitFirstPage !== false;

  if (omitFirstPage && page <= startPage) {
    return baseUrl;
  }

  const pattern = pagination.pattern || '?page={page}';
  const pageValue = page + (pagination.pageOffset ?? 0);
  const suffix = pattern.replace('{page}', String(pageValue));
  const type = pagination.type || 'query';

  if (type === 'query' || type === 'custom') {
    const queryPart = suffix.startsWith('?') ? suffix.slice(1) : suffix;
    const separator = baseUrl.includes('?') ? '&' : '?';
    return `${baseUrl}${separator}${queryPart}`;
  }

  const pathSuffix = suffix.startsWith('/') ? suffix : `/${suffix}`;
  return `${stripTrailingSlash(baseUrl)}${pathSuffix}`;
}

/**
 * Apply pagination to a parent/children URL.
 * @param {string} parentUrl
 * @param {number} page
 * @param {object} [pagination]
 * @returns {string}
 */
function buildChildrenPaginatedUrl(parentUrl, page = 1, pagination = {}) {
  return buildPaginatedUrl(parentUrl, page, {
    type: pagination.childrenType || pagination.type || 'path',
    pattern: pagination.childrenPattern || pagination.pattern || '/page/{page}',
    omitFirstPage: pagination.omitFirstPage !== false,
    startPage: pagination.startPage ?? 1,
    pageOffset: pagination.pageOffset ?? 0,
  });
}

module.exports = {
  buildPaginatedUrl,
  buildChildrenPaginatedUrl,
};
