'use strict';

const { itemIdFromUrl } = require('../../src/utils/itemId.util');
const xvideosSelectors = require('../../src/scrapers/sites/xvideos/selectors');
const tubevSelectors = require('../../src/scrapers/sites/tubev/selectors');

/**
 * Mirrors SiteAdapter.isChildVideoUrl without loading cheerio (Jest/Node 24).
 * @param {string} url
 * @param {RegExp[]} patterns
 */
function matchesChildPatterns(url, patterns) {
  const pathname = new URL(url).pathname || '';
  return patterns.some((re) => re.test(pathname));
}

describe('itemIdFromUrl', () => {
  test('stable short hash for same canonical URL', () => {
    const a = itemIdFromUrl('https://www.tubev.sex/watch/1/');
    const b = itemIdFromUrl('https://www.tubev.sex/watch/1');
    expect(a).toMatch(/^[a-f0-9]{16}$/);
    expect(a).toBe(b);
  });

  test('different URLs get different ids', () => {
    expect(itemIdFromUrl('https://www.tubev.sex/watch/1')).not.toBe(
      itemIdFromUrl('https://www.tubev.sex/watch/2'),
    );
  });
});

describe('site childUrlPatterns (Flutter Detail/Stream guard)', () => {
  test('xvideos accepts watch URL and rejects tags', () => {
    const patterns = xvideosSelectors.childUrlPatterns;
    expect(matchesChildPatterns('https://www.xvideos.com/video.uecokohb9e4/sample', patterns)).toBe(
      true,
    );
    expect(matchesChildPatterns('https://www.xvideos.com/tags/amateur', patterns)).toBe(false);
  });

  test('tubev accepts watch URL and rejects channels index', () => {
    const patterns = tubevSelectors.childUrlPatterns;
    expect(matchesChildPatterns('https://www.tubev.sex/watch/sample', patterns)).toBe(true);
    expect(matchesChildPatterns('https://www.tubev.sex/channels', patterns)).toBe(false);
  });
});
