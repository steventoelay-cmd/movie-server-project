'use strict';

const path = require('path');
const os = require('os');
const fsp = require('fs/promises');
const request = require('supertest');
const { createMockedApp, defaultDetail, defaultStream } = require('../helpers/createTestApp');
const { DetailCache } = require('../../src/infrastructure/cache/DetailCache');
const { parseDetail } = require('../../src/scrapers/parsers/parseDetail');
const { parseStream } = require('../../src/scrapers/parsers/parseStream');
const { DEFAULT_STREAM_EXTRACTION } = require('../../src/scrapers/parsers/streamDefaults');
const { readJsonFile, removeDir } = require('../../src/utils/file.util');
const { loadHtml, DETAIL_CONFIG, SAMPLE_PAGE_URL } = require('../helpers/fixtures');

describe('Failure recovery', () => {
  test('invalid HTML still yields parseable empty-ish detail', () => {
    const raw = parseDetail('<<<not html', DETAIL_CONFIG, SAMPLE_PAGE_URL);
    expect(raw).toEqual(
      expect.objectContaining({
        title: expect.any(String),
        related: expect.any(Array),
      }),
    );
  });

  test('m3u8 missing does not throw in parser', () => {
    const parsed = parseStream(loadHtml('stream-no-m3u8.html'), DEFAULT_STREAM_EXTRACTION, SAMPLE_PAGE_URL);
    expect(parsed.m3u8).toBeNull();
  });

  test('API recovers after scraper failure on next request', async () => {
    let calls = 0;
    const getDetail = jest.fn(async () => {
      calls += 1;
      if (calls === 1) {
        const err = new Error('Website unavailable');
        err.statusCode = 502;
        err.code = 'FETCH_FAILED';
        err.expose = true;
        throw err;
      }
      return defaultDetail();
    });
    const { app } = createMockedApp({ getDetail });
    const url = SAMPLE_PAGE_URL;

    await request(app).get('/detail').query({ url }).expect(502);
    const ok = await request(app).get('/detail').query({ url }).expect(200);
    expect(ok.body.title).toBe('Mock Detail');
  });

  test('stream network-style failure returns envelope then succeeds', async () => {
    let calls = 0;
    const getStream = jest.fn(async () => {
      calls += 1;
      if (calls === 1) {
        const err = new Error('timeout');
        err.statusCode = 408;
        err.code = 'REQUEST_TIMEOUT';
        err.expose = true;
        throw err;
      }
      return defaultStream();
    });
    const { app } = createMockedApp({ getStream });

    const fail = await request(app).get('/stream').query({ url: SAMPLE_PAGE_URL }).expect(408);
    expect(fail.body.success).toBe(false);
    await request(app).get('/stream').query({ url: SAMPLE_PAGE_URL }).expect(200);
  });

  test('corrupt cache file is treated as miss', async () => {
    const tmp = path.join(os.tmpdir(), `corrupt-cache-${Date.now()}`);
    await fsp.mkdir(tmp, { recursive: true });
    try {
      const cache = new DetailCache({ dir: tmp, ttlMs: 60_000, maxEntries: 10 });
      const url = SAMPLE_PAGE_URL;
      await cache.set(url, {
        schemaVersion: 1,
        title: 'T',
        img: '',
        description: '',
        metadata: {},
        related: [],
      });

      // Corrupt a file on disk under cache dir
      const files = await fsp.readdir(tmp);
      expect(files.length).toBeGreaterThan(0);
      await fsp.writeFile(path.join(tmp, files[0]), '{not-json', 'utf8');

      // Memory may still hit — clear by using a fresh instance reading same dir
      const cold = new DetailCache({ dir: tmp, ttlMs: 60_000, maxEntries: 10 });
      const result = await cold.get(url);
      expect(result.hit).toBe(false);

      const parsed = await readJsonFile(path.join(tmp, files[0]));
      expect(parsed).toBeNull();
    } finally {
      await removeDir(tmp);
    }
  });

  test('GitHubError carries safe code without crashing process', () => {
    const { GitHubError } = require('../../src/domain/errors/GitHubError');
    const err = new GitHubError('upload failed', { statusCode: 502, code: 'GITHUB_API_ERROR' });
    expect(err).toBeInstanceOf(Error);
    expect(err.code).toBe('GITHUB_API_ERROR');
    expect(err.statusCode).toBe(502);
  });
});
