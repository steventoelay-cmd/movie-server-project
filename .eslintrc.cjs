'use strict';

module.exports = {
  root: true,
  env: {
    node: true,
    es2022: true,
    jest: true,
  },
  extends: ['eslint:recommended'],
  parserOptions: {
    ecmaVersion: 2022,
  },
  ignorePatterns: ['node_modules/', 'coverage/', 'output/', 'data/', 'cache/'],
  rules: {
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
    'no-console': 'off',
    'no-empty': ['error', { allowEmptyCatch: true }],
  },
};
