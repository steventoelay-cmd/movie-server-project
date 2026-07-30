'use strict';

const request = require('supertest');
const { createMockedApp } = require('../helpers/createTestApp');

const VALID_URL = 'https://www.tubev.sex/watch/sample';
const TEST_KEY = '0123456789abcdef0123456789abcdef';

describe('API key authentication', () => {
  const originalKey = process.env.API_KEY;
  const originalRequire = process.env.REQUIRE_API_KEY;

  afterEach(() => {
    if (originalKey === undefined) {
      delete process.env.API_KEY;
    } else {
      process.env.API_KEY = originalKey;
    }
    if (originalRequire === undefined) {
      delete process.env.REQUIRE_API_KEY;
    } else {
      process.env.REQUIRE_API_KEY = originalRequire;
    }
    jest.resetModules();
  });

  function buildAppWithKey() {
    process.env.API_KEY = TEST_KEY;
    process.env.REQUIRE_API_KEY = 'true';
    jest.resetModules();
    return createMockedApp().app;
  }

  test('rejects /detail when X-Api-Key is missing', async () => {
    const app = buildAppWithKey();
    const res = await request(app).get('/detail').query({ url: VALID_URL }).expect(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  test('rejects /detail when X-Api-Key is wrong', async () => {
    const app = buildAppWithKey();
    const res = await request(app)
      .get('/detail')
      .set('X-Api-Key', 'wrong-key-value-0123456789ab')
      .query({ url: VALID_URL })
      .expect(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  test('allows /detail when X-Api-Key matches', async () => {
    const app = buildAppWithKey();
    const res = await request(app)
      .get('/detail')
      .set('X-Api-Key', TEST_KEY)
      .query({ url: VALID_URL })
      .expect(200);
    expect(res.body.title).toBe('Mock Detail');
  });

  test('health stays public without API key', async () => {
    const app = buildAppWithKey();
    await request(app).get('/health').expect(200);
  });
});
