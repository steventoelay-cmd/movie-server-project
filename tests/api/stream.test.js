'use strict';

const request = require('supertest');
const { createMockedApp, defaultStream } = require('../helpers/createTestApp');

const VALID_URL = 'https://www.tubev.sex/watch/sample';

describe('GET /stream', () => {
  test('valid stream returns success + stream.url', async () => {
    const getStream = jest.fn(async () => defaultStream());
    const { app } = createMockedApp({ getStream });

    const res = await request(app).get('/stream').query({ url: VALID_URL }).expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.stream.url).toContain('.m3u8');
    expect(res.body.stream.expiresIn).toBe(300);
    expect(res.headers['x-cache']).toBe('MISS');
  });

  test('expired/stale cache reports STALE header', async () => {
    const getStream = jest.fn(async () => ({
      ...defaultStream(),
      cache: { hit: true, age: 400, stale: true },
    }));
    const { app } = createMockedApp({ getStream });

    const res = await request(app).get('/api/stream').query({ url: VALID_URL }).expect(200);
    expect(res.headers['x-cache']).toBe('STALE');
  });

  test('failed extraction returns success:false', async () => {
    const err = new Error('No playable m3u8 found on video page');
    err.statusCode = 404;
    err.code = 'M3U8_NOT_FOUND';
    err.expose = true;
    const getStream = jest.fn(async () => {
      throw err;
    });
    const { app } = createMockedApp({ getStream });

    const res = await request(app).get('/stream').query({ url: VALID_URL }).expect(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('M3U8_NOT_FOUND');
  });

  test('multiple concurrent requests share mocked service calls', async () => {
    let active = 0;
    let maxActive = 0;
    const getStream = jest.fn(async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((r) => setTimeout(r, 20));
      active -= 1;
      return defaultStream();
    });
    const { app } = createMockedApp({ getStream });

    await Promise.all(
      Array.from({ length: 8 }, () => request(app).get('/stream').query({ url: VALID_URL })),
    );

    expect(getStream.mock.calls.length).toBe(8);
    expect(maxActive).toBeGreaterThan(1);
  });

  test('missing url returns stream error envelope', async () => {
    const { app } = createMockedApp();
    const res = await request(app).get('/stream').expect(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('URL_REQUIRED');
  });
});
