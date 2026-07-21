'use strict';

const { isValidHttpUrl, resolveUrl, canonicalizeUrl } = require('../../src/utils/url.util');

describe('url.util', () => {
  test('validates http(s) URLs', () => {
    expect(isValidHttpUrl('https://www.tubev.sex/a')).toBe(true);
    expect(isValidHttpUrl('http://example.com')).toBe(true);
    expect(isValidHttpUrl('ftp://x')).toBe(false);
    expect(isValidHttpUrl('')).toBe(false);
    expect(isValidHttpUrl(null)).toBe(false);
  });

  test('resolves relative image/urls', () => {
    expect(resolveUrl('/poster.jpg', 'https://www.tubev.sex/watch/1')).toBe(
      'https://www.tubev.sex/poster.jpg',
    );
    expect(resolveUrl('https://cdn.example.com/a.jpg', 'https://www.tubev.sex/x')).toBe(
      'https://cdn.example.com/a.jpg',
    );
  });

  test('canonicalizes for dedupe', () => {
    expect(canonicalizeUrl('https://WWW.Tubev.sex/watch/1/#frag')).toBe(
      'https://www.tubev.sex/watch/1',
    );
    expect(canonicalizeUrl('https://www.tubev.sex/watch/1/')).toBe(
      'https://www.tubev.sex/watch/1',
    );
  });
});
