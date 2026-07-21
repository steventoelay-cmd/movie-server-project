'use strict';

/**
 * Public entry — scraper engine, catalog pipeline, detail API modules.
 * Start HTTP with: node src/server.js  (or npm start)
 */
const scrapers = require('./scrapers');
const { SyncOrchestrator } = require('./application/sync/SyncOrchestrator');
const { PipelineScheduler } = require('./jobs/scheduler');
const { runScrapingJob } = require('./jobs/scraping.job');
const { GitHubSyncService } = require('./infrastructure/github');
const { JsonGeneratorService } = require('./application/catalog/JsonGeneratorService');
const { CatalogDiffService } = require('./application/catalog/CatalogDiffService');
const { CatalogProcessService } = require('./application/catalog/CatalogProcessService');
const { DetailService } = require('./application/detail/DetailService');
const { RelatedService } = require('./application/related/RelatedService');
const { StreamService } = require('./application/stream/StreamService');
const { DetailCache, StreamCache, getDetailCache, getStreamCache, getHtmlPageCache } = require('./infrastructure/cache');
const { getMetrics } = require('./infrastructure/metrics/MetricsCollector');
const { createApp, startServer } = require('./server');
const { SiteResolver } = require('./scrapers/core/SiteResolver');
const { runCleanupJob } = require('./jobs/cleanup.job');

module.exports = {
  ...scrapers,
  SyncOrchestrator,
  PipelineScheduler,
  runScrapingJob,
  GitHubSyncService,
  JsonGeneratorService,
  CatalogDiffService,
  CatalogProcessService,
  DetailService,
  RelatedService,
  StreamService,
  DetailCache,
  StreamCache,
  getDetailCache,
  getStreamCache,
  getHtmlPageCache,
  getMetrics,
  runCleanupJob,
  SiteResolver,
  createApp,
  startServer,
};

if (require.main === module) {
  const engine = scrapers.createScraperEngine();
  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        message: 'Movies server modules ready',
        sites: engine.listSites(),
        sections: Object.values(scrapers.SECTIONS),
        http: {
          start: 'npm start',
          detail: 'GET /detail?url=<child_video_url>',
          stream: 'GET /stream?url=<child_video_url>',
          health: 'GET /health',
          admin: 'POST /admin/pipeline',
        },
        pipeline: {
          run: 'npm run pipeline',
          schedule: 'npm run scheduler',
          localOnly: 'npm run pipeline:local',
        },
      },
      null,
      2,
    ),
  );
}
