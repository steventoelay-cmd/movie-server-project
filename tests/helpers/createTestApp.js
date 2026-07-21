'use strict';

/**
 * Build Express app with mocked Detail/Stream services for API tests.
 * Does not hit real websites. Uses isolateModules so mocks do not leak.
 */

function defaultDetail() {
  return {
    schemaVersion: 1,
    title: 'Mock Detail',
    img: 'https://cdn.example.com/p.jpg',
    description: 'desc',
    metadata: {
      duration: '01:00',
      releaseDate: '',
      category: '',
      tags: [],
      locale: null,
      subtitles: [],
      rating: null,
    },
    related: [
      {
        title: 'Rel',
        img: 'https://cdn.example.com/r.jpg',
        url: 'https://www.tubev.sex/watch/rel',
      },
    ],
    extensions: { sourceUrl: 'https://www.tubev.sex/watch/sample' },
    _meta: { cacheHit: false, durationMs: 5 },
  };
}

function defaultStream() {
  return {
    success: true,
    stream: {
      url: 'https://cdn.example.com/play.m3u8?token=abc',
      expiresIn: 300,
      type: 'm3u8',
      qualities: [],
      mirrors: [],
      subtitles: [],
      audioTracks: [],
      drm: null,
      adaptive: true,
    },
    cache: { hit: false, age: 0, stale: false },
    meta: { siteId: 'tubev', durationMs: 8, retries: 0, schemaVersion: 1 },
  };
}

function createMockedApp(options = {}) {
  const getDetail = options.getDetail || jest.fn(async () => defaultDetail());
  const getStream = options.getStream || jest.fn(async () => defaultStream());

  let app;

  jest.isolateModules(() => {
    jest.doMock('../../src/application/detail/DetailService', () => {
      const actual = jest.requireActual('../../src/application/detail/DetailService');
      return {
        DetailService: jest.fn().mockImplementation(() => ({ getDetail })),
        shapeResponse: actual.shapeResponse,
      };
    });

    jest.doMock('../../src/application/stream/StreamService', () => {
      const actual = jest.requireActual('../../src/application/stream/StreamService');
      return {
        StreamService: jest.fn().mockImplementation(() => ({ getStream })),
        buildSuccessResponse: actual.buildSuccessResponse,
      };
    });

    // eslint-disable-next-line global-require
    app = require('../../src/app').createApp();
  });

  return { app, getDetail, getStream };
}

module.exports = { createMockedApp, defaultDetail, defaultStream };
