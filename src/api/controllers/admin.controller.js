'use strict';

const { SyncOrchestrator } = require('../../application/sync/SyncOrchestrator');
const { createLogger } = require('../../infrastructure/logging/logger');

const logger = createLogger('api.admin');
const orchestrator = new SyncOrchestrator();

/**
 * Manual pipeline trigger — auth enforced by adminAuth middleware.
 */
async function triggerPipeline(req, res, next) {
  try {
    const sections = req.body?.sections || req.query.sections || 'all';
    const upload =
      req.body?.upload !== undefined
        ? Boolean(req.body.upload)
        : req.query.upload !== 'false';

    logger.info('Admin pipeline trigger', {
      requestId: req.requestId,
      sections,
      upload,
    });

    // Fire-and-return for long runs would be nicer; await keeps status accurate for ops
    const report = await orchestrator.run({
      sections,
      upload,
    });

    res.json({
      ok: report.errors.length === 0,
      durationMs: report.durationMs,
      sections: report.sections,
      filesChanged: report.filesChanged?.length || 0,
      filesUploaded: report.filesUploaded || 0,
      errors: report.errors,
      requestId: req.requestId,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = { triggerPipeline };
