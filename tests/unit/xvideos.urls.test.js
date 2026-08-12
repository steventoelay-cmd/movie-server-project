'use strict';

const { joinSiteUrl, resolveHomeListPath, currentBestMonthPath } = require('../../src/utils/siteUrl.util');
const { buildPaginatedUrl, buildChildrenPaginatedUrl } = require('../../src/scrapers/core/pagination');
const selectors = require('../../src/scrapers/sites/xvideos/selectors');
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

  test('resolveHomeListPath uses current month for /best/current and stale paths', () => {
    const current = currentBestMonthPath();
    expect(resolveHomeListPath('/best/current')).toBe(current);
    expect(resolveHomeListPath('/best/2026-05')).toBe(current);
    expect(resolveHomeListPath('/best/2026-05', { autoCurrentMonth: false })).toBe('/best/2026-05');
  });

  test('env resolves xvideos section URLs', () => {
    expect(env.sites.xvideosHomeUrl).toContain('xvideos.com');
    expect(env.sites.xvideosMyanmarUrl).toContain('k=myanmar');
    expect(env.sites.watchReferer).toContain('xvideos.com');
    expect(env.sections.homeSite).toBe('xvideos');
  });

  test('xvideos env section URLs', () => {
    expect(env.sites.xvideosHomeUrl).toContain('xvideos.com');
    expect(env.sites.xvideosMyanmarUrl).toContain('k=myanmar');
    expect(env.sites.watchReferer).toContain('xvideos.com');
    expect(env.sections.homeSite).toBe('xvideos');
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

  test('channel children use channel search, not generic ?u= slug', () => {
    const segment = '18eighteen';
    const base = `https://www.xvideos.com/?k=${encodeURIComponent(`channel:${segment}`)}`;
    const pagination = selectors.childrenConfigs.channel.pagination;
    const page1 = buildChildrenPaginatedUrl(base, 1, pagination);
    const page2 = buildChildrenPaginatedUrl(base, 2, pagination);
    expect(page1).toBe('https://www.xvideos.com/?k=channel%3A18eighteen');
    expect(page2).toBe('https://www.xvideos.com/?k=channel%3A18eighteen&p=1');
    expect(page1).not.toContain('?u=');
  });
});
