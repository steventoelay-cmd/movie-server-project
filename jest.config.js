'use strict';

/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.js'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  clearMocks: true,
  restoreMocks: true,
  testTimeout: 30000,
  verbose: true,
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/cli/**',
    '!src/index.js',
    '!src/server.js',
    '!src/jobs/**',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'json-summary'],
  // Load suite is opt-in via TEST_LOAD=1 to keep default CI fast
  testPathIgnorePatterns:
    process.env.TEST_LOAD === '1' ? [] : ['/tests/load/'],
};
