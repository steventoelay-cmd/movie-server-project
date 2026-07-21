'use strict';

/**
 * Process memory snapshot helpers.
 */
function getMemoryStats() {
  const mem = process.memoryUsage();
  return {
    rssMB: round(mem.rss / 1024 / 1024),
    heapUsedMB: round(mem.heapUsed / 1024 / 1024),
    heapTotalMB: round(mem.heapTotal / 1024 / 1024),
    externalMB: round(mem.external / 1024 / 1024),
    arrayBuffersMB: round((mem.arrayBuffers || 0) / 1024 / 1024),
  };
}

function round(n) {
  return Math.round(n * 10) / 10;
}

/**
 * Hint GC when available (node --expose-gc). Safe no-op otherwise.
 */
function maybeGc() {
  if (typeof global.gc === 'function') {
    global.gc();
    return true;
  }
  return false;
}

module.exports = {
  getMemoryStats,
  maybeGc,
};
