'use strict';

/**
 * Scraping / catalog sync job entry (thin wrapper).
 */
const { PipelineScheduler } = require('./scheduler');
const { SyncOrchestrator } = require('../application/sync/SyncOrchestrator');

async function runScrapingJob(options = {}) {
  const orchestrator = options.orchestrator || new SyncOrchestrator(options);
  return orchestrator.run(options);
}

module.exports = {
  runScrapingJob,
  PipelineScheduler,
};
