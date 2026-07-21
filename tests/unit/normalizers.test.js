'use strict';

const { normalizeVideoList } = require('../../src/scrapers/normalizers/videoItem.normalizer');
const { normalizeDetail } = require('../../src/scrapers/normalizers/detail.normalizer');
const { collapseWhitespace } = require('../../src/utils/string.util');

describe('normalizers', () => {
  test('normalizes titles and removes invalid/duplicate items', () => {
    const { items, dropped, duplicates } = normalizeVideoList([
      { title: '  Hello   World ', img: 'https://cdn.example.com/a.jpg', url: 'https://www.tubev.sex/a' },
      { title: 'Hello World', img: 'https://cdn.example.com/a.jpg', url: 'https://www.tubev.sex/a/' },
      { title: '', img: 'https://cdn.example.com/b.jpg', url: 'https://www.tubev.sex/b' },
      { title: 'Bad', img: 'not-a-url', url: 'javascript:alert(1)' },
      { title: 'Ok', img: 'https://cdn.example.com/c.jpg', url: 'https://www.tubev.sex/c' },
    ]);

    expect(dropped).toBeGreaterThanOrEqual(1);
    expect(duplicates).toBeGreaterThanOrEqual(1);
    expect(items.every((i) => i.title && i.url.startsWith('http'))).toBe(true);
    expect(items.find((i) => i.url.includes('/c'))).toBeTruthy();
  });

  test('collapseWhitespace', () => {
    expect(collapseWhitespace('  a   b  ')).toBe('a b');
  });

  test('normalizeDetail strips self-related and invalid img', () => {
    const pageUrl = 'https://www.tubev.sex/watch/sample';
    const detail = normalizeDetail(
      {
        title: '  T  ',
        img: 'not-http',
        description: 'd',
        duration: '1:00',
        tags: ['A', 'A', ''],
        related: [
          { title: 'R', img: 'https://cdn.example.com/r.jpg', url: 'https://www.tubev.sex/watch/r' },
          { title: 'Self', img: 'https://cdn.example.com/s.jpg', url: pageUrl },
        ],
      },
      pageUrl,
    );

    expect(detail.title).toBe('T');
    expect(detail.img).toBe('');
    expect(detail.metadata.tags).toEqual(['A']);
    expect(detail.related).toHaveLength(1);
    expect(detail.related[0].url).toContain('/watch/r');
    expect(detail).not.toHaveProperty('m3u8');
  });
});
