/**
 * Future job queue contract (in-process cron → BullMQ / SQS / RabbitMQ).
 *
 * Current job names (keep stable when migrating):
 * - catalog.scrape
 * - catalog.generateJson
 * - catalog.githubSync
 * - cache.cleanup
 *
 * @typedef {object} JobEnvelope
 * @property {string} name
 * @property {object} [payload]
 * @property {number} [delayMs]
 * @property {number} [attempts]
 *
 * @typedef {object} IJobQueue
 * @property {(job: JobEnvelope) => Promise<{ id: string }>} enqueue
 * @property {(name: string, handler: Function) => void} process
 * @property {() => Promise<void>} [close]
 */

'use strict';

function isJobQueue(queue) {
  return Boolean(
    queue && typeof queue.enqueue === 'function' && typeof queue.process === 'function',
  );
}

module.exports = { isJobQueue };
