'use strict';

const { parseDetail } = require('../../src/scrapers/parsers/parseDetail');
const { parseStream } = require('../../src/scrapers/parsers/parseStream');
const { DEFAULT_STREAM_EXTRACTION } = require('../../src/scrapers/parsers/streamDefaults');
const { loadHtml, DETAIL_CONFIG, SAMPLE_PAGE_URL } = require('../helpers/fixtures');

describe('HTML parsers (mock fixtures)', () => {
  test('parseDetail extracts title, image, description, tags, related', () => {
    const raw = parseDetail(loadHtml('detail-normal.html'), DETAIL_CONFIG, SAMPLE_PAGE_URL);
    expect(raw.title).toBe('Sample Video');
    expect(raw.img).toContain('poster.jpg');
    expect(raw.description).toBe('A description');
    expect(raw.duration).toBe('12:34');
    expect(raw.tags).toEqual(['Action', 'Drama']);
    expect(raw.related.length).toBeGreaterThanOrEqual(1);
  });

  test('parseDetail handles empty / missing fields without throwing', () => {
    const raw = parseDetail(loadHtml('detail-empty.html'), DETAIL_CONFIG, SAMPLE_PAGE_URL);
    expect(typeof raw.title).toBe('string');
    expect(Array.isArray(raw.related)).toBe(true);
  });

  test('parseDetail falls back when HTML structure changes', () => {
    const raw = parseDetail(loadHtml('detail-changed.html'), DETAIL_CONFIG, SAMPLE_PAGE_URL);
    expect(raw.title).toBe('Changed Structure Title');
    expect(raw.img).toContain('cdn.example.com');
  });

  test('parseStream extracts m3u8 from normal HTML', () => {
    const parsed = parseStream(loadHtml('stream-normal.html'), DEFAULT_STREAM_EXTRACTION, SAMPLE_PAGE_URL);
    expect(parsed.m3u8).toBeTruthy();
    expect(parsed.m3u8).toContain('.m3u8');
  });

  test('parseStream returns null m3u8 when missing', () => {
    const parsed = parseStream(loadHtml('stream-no-m3u8.html'), DEFAULT_STREAM_EXTRACTION, SAMPLE_PAGE_URL);
    expect(parsed.m3u8).toBeNull();
  });
});
