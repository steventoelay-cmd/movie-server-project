'use strict';

const { validateStreamUrl } = require('../../src/utils/stream.validator');
const { assertSafeFetchUrl } = require('../../src/utils/ssrf.util');

describe('validators', () => {
  test('validateStreamUrl', () => {
    expect(validateStreamUrl('').valid).toBe(false);
    expect(validateStreamUrl('not-a-url').valid).toBe(false);
    expect(validateStreamUrl('https://x.com/a.mp4', { requireM3u8: true }).valid).toBe(false);
    expect(validateStreamUrl('https://cdn.example.com/a.m3u8').valid).toBe(true);

    const expired = `https://cdn.example.com/a.m3u8?expires=${Math.floor(Date.now() / 1000) - 3600}`;
    expect(validateStreamUrl(expired).reason).toBe('expired_url');
  });

  test('assertSafeFetchUrl blocks SSRF targets', () => {
    expect(assertSafeFetchUrl('').ok).toBe(false);
    expect(assertSafeFetchUrl('file:///etc/passwd').ok).toBe(false);
    expect(assertSafeFetchUrl('http://localhost/a').ok).toBe(false);
    expect(assertSafeFetchUrl('http://127.0.0.1/a').ok).toBe(false);
    expect(assertSafeFetchUrl('http://192.168.1.1/a').ok).toBe(false);
    expect(assertSafeFetchUrl('https://www.tubev.sex/watch/1').ok).toBe(true);
  });
});
