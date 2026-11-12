'use strict';

const { itemIdFromUrl } = require('../../src/utils/itemId.util');
const xvideosSelectors = require('../../src/scrapers/sites/xvideos/selectors');

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
    const a = itemIdFromUrl('https://www.xvideos.com/video.abc/sample/');
    const b = itemIdFromUrl('https://www.xvideos.com/video.abc/sample');
    expect(a).toMatch(/^[a-f0-9]{16}$/);
    expect(a).toBe(b);
  });

  test('different URLs get different ids', () => {
    expect(itemIdFromUrl('https://www.xvideos.com/video.abc/one')).not.toBe(
      itemIdFromUrl('https://www.xvideos.com/video.abc/two'),
    );
  });
});

describe('site childUrlPatterns (Flutter Detail/Stream guard)', () => {
  test('xvideos accepts a video URL and rejects a tag page', () => {
    const patterns = xvideosSelectors.childUrlPatterns;
    expect(matchesChildPatterns('https://www.xvideos.com/video.uecokohb9e4/sample', patterns)).toBe(
      true,
    );
    expect(matchesChildPatterns('https://www.xvideos.com/tags/amateur', patterns)).toBe(false);
  });
});
