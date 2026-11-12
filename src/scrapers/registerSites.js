'use strict';

const { defaultRegistry } = require('./core/AdapterRegistry');
const { createXvideosAdapter } = require('./sites/xvideos');

let registered = false;

/**
 * Register all built-in website adapters once.
 * Adding a site: create sites/{id}, then register here — no other adapter changes.
 *
 * @param {import('./core/AdapterRegistry').AdapterRegistry} [registry]
 */
function registerSites(registry = defaultRegistry) {
  if (registered && registry === defaultRegistry) {
    return registry;
  }

  if (!registry.has('xvideos')) {
    registry.register(createXvideosAdapter());
  }

  if (registry === defaultRegistry) {
    registered = true;
  }
  return registry;
}

module.exports = { registerSites };
