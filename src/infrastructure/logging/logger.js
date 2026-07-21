'use strict';

const { env } = require('../../config/env');
const { redactSensitive } = require('../../utils/sanitize.util');

const LEVELS = Object.freeze({
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
});

const currentLevel = LEVELS[env.logLevel] ?? LEVELS.info;

/**
 * @param {'debug'|'info'|'warn'|'error'} level
 * @param {string} message
 * @param {object} [meta]
 */
function write(level, message, meta = {}) {
  if ((LEVELS[level] ?? 99) < currentLevel) {
    return;
  }

  const safeMeta = redactSensitive(meta);
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...safeMeta,
  };

  const line =
    env.nodeEnv === 'production'
      ? JSON.stringify(entry)
      : `[${entry.timestamp}] [${level.toUpperCase()}] ${message}${
          Object.keys(safeMeta).length ? ` ${JSON.stringify(safeMeta)}` : ''
        }`;

  if (level === 'error') {
    console.error(line);
  } else if (level === 'warn') {
    console.warn(line);
  } else {
    console.log(line);
  }
}

/**
 * @param {string} scope
 */
function createLogger(scope) {
  const base = { scope };
  return {
    debug: (message, meta = {}) => write('debug', message, { ...base, ...meta }),
    info: (message, meta = {}) => write('info', message, { ...base, ...meta }),
    warn: (message, meta = {}) => write('warn', message, { ...base, ...meta }),
    error: (message, meta = {}) => write('error', message, { ...base, ...meta }),
    child(extra = {}) {
      return createLogger([scope, extra.scope].filter(Boolean).join('.') || scope);
    },
  };
}

const logger = createLogger('app');
const scraperLogger = createLogger('scraper');

module.exports = {
  logger,
  scraperLogger,
  createLogger,
};
