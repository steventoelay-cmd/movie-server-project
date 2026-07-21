/**
 * Future object / CDN storage contract (GitHub → S3/R2/GCS).
 *
 * Today: GitHubSyncService uploads JSON blobs.
 * Tomorrow: swap implementation; SyncOrchestrator still calls putObjects().
 *
 * @typedef {{ path: string, content: string|Buffer, contentType?: string }} StorageObject
 *
 * @typedef {object} IObjectStorage
 * @property {(objects: StorageObject[]) => Promise<{ uploaded: string[] }>} putObjects
 * @property {(paths: string[]) => Promise<void>} [deleteObjects]
 * @property {() => Promise<object>} [getVersionManifest]
 */

'use strict';

function isObjectStorage(storage) {
  return Boolean(storage && typeof storage.putObjects === 'function');
}

module.exports = { isObjectStorage };
