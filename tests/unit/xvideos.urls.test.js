'use strict';

const { joinSiteUrl } = require('../../src/utils/siteUrl.util');
const { buildPaginatedUrl } = require('../../src/scrapers/core/pagination');
const { registerSites } = require('../../src/scrapers/registerSites');
const { defaultRegistry } = require('../../src/scrapers/core/AdapterRegistry');
const { SECTIONS } = require('../../src/domain/constants/sections');
const { env } = require('../../src/config/env');

describe('xvideos URL wiring', () => {
  test('joinSiteUrl builds catalog URLs', () => {
    expect(joinSiteUrl('https://www.xvideos.com', '/best/2026-05')).toBe(
      'https://www.xvideos.com/best/2026-05',
    );
    expect(joinSiteUrl('https://www.xvideos.com', '/?k=myanmar')).toBe(
      'https://www.xvideos.com/?k=myanmar',
    );
    expect(joinSiteUrl('https://www.xvideos.com/', 'pornstars-index')).toBe(
      'https://www.xvideos.com/pornstars-index',
    );
  });

  test('env resolves xvideos section URLs', () => {
    expect(env.sites.xvideosHomeUrl).toContain('xvideos.com');
    expect(env.sites.xvideosMyanmarUrl).toContain('k=myanmar');
    expect(env.sites.watchReferer).toContain('xvideos.com');
    expect(env.sections.homeSite).toBe('xvideos');
  });

  test('xvideos adapter builds home + myanmar pages', () => {
    registerSites(defaultRegistry);
    const adapter = defaultRegistry.get('xvideos');
    expect(adapter.supportsSection(SECTIONS.HOME)).toBe(true);
    expect(adapter.supportsSection(SECTIONS.MYANMAR)).toBe(true);
    expect(adapter.supportsSection(SECTIONS.MODEL)).toBe(true);
    expect(adapter.buildSectionUrl(SECTIONS.HOME, 1)).toBe(env.sites.xvideosHomeUrl);
    expect(adapter.buildSectionUrl(SECTIONS.HOME, 2)).toMatch(/\/2$/);
    expect(adapter.buildSectionUrl(SECTIONS.MYANMAR, 1)).toBe(env.sites.xvideosMyanmarUrl);
    expect(adapter.buildSectionUrl(SECTIONS.MYANMAR, 2)).toContain('p=1');
    expect(adapter.headers.Referer).toBe(env.sites.watchReferer);
  });

  test('search pagination appends with & when query exists', () => {
    const url = buildPaginatedUrl('https://www.xvideos.com/?k=myanmar', 2, {
      type: 'query',
      pattern: 'p={page}',
      omitFirstPage: true,
      pageOffset: -1,
    });
    expect(url).toBe('https://www.xvideos.com/?k=myanmar&p=1');
  });
});
