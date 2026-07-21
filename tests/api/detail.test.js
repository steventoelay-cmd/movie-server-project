'use strict';

const request = require('supertest');
const { createMockedApp, defaultDetail } = require('../helpers/createTestApp');

const VALID_URL = 'https://www.tubev.sex/watch/sample';

describe('GET /detail', () => {
  test('valid URL returns detail without m3u8', async () => {
    const getDetail = jest.fn(async () => ({
      ...defaultDetail(),
      _meta: { cacheHit: false, durationMs: 12 },
    }));
    const { app } = createMockedApp({ getDetail });

    const res = await request(app).get('/detail').query({ url: VALID_URL }).expect(200);

    expect(res.body.title).toBe('Mock Detail');
    expect(Array.isArray(res.body.related)).toBe(true);
    expect(res.body).not.toHaveProperty('m3u8');
    expect(res.body).not.toHaveProperty('success');
    expect(res.headers['x-cache']).toBe('MISS');
    expect(getDetail).toHaveBeenCalled();
  });

  test('cache hit sets X-Cache HIT', async () => {
    const getDetail = jest.fn(async () => ({
      ...defaultDetail(),
      _meta: { cacheHit: true, durationMs: 1 },
    }));
    const { app } = createMockedApp({ getDetail });

    const res = await request(app).get('/api/detail').query({ url: VALID_URL }).expect(200);
    expect(res.headers['x-cache']).toBe('HIT');
  });

  test('missing url returns validation error', async () => {
    const { app } = createMockedApp();
    const res = await request(app).get('/detail').expect(400);
    expect(res.body.error.code).toBe('URL_REQUIRED');
  });

  test('invalid / private URL rejected', async () => {
    const { app } = createMockedApp();
    const res = await request(app)
      .get('/detail')
      .query({ url: 'http://127.0.0.1/secret' })
      .expect(400);
    expect(res.body.error.code).toMatch(/LOCALHOST|PRIVATE|FORBIDDEN/);
  });

  test('scraper failure maps to error envelope', async () => {
    const err = new Error('upstream scrape failed');
    err.statusCode = 502;
    err.code = 'SCRAPE_ERROR';
    err.expose = true;
    const getDetail = jest.fn(async () => {
      throw err;
    });
    const { app } = createMockedApp({ getDetail });

    const res = await request(app).get('/detail').query({ url: VALID_URL }).expect(502);
    expect(res.body.error.code).toBe('SCRAPE_ERROR');
    expect(res.body.error.message).toBeTruthy();
  });
});
