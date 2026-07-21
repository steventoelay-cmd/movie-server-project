'use strict';

const request = require('supertest');
const { createMockedApp } = require('../helpers/createTestApp');

describe('GET /health', () => {
  test('returns ok status and contract fields', async () => {
    const { app } = createMockedApp();
    const res = await request(app).get('/health').expect(200);
    expect(res.body.status).toBe('ok');
    expect(typeof res.body.uptimeSec).toBe('number');
    expect(res.body.timestamp).toBeTruthy();
  });
});
