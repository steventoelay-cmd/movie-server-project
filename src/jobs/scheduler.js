'use strict';

const { SECTIONS } = require('../domain/constants/sections');
const cron = require('node-cron');
const { schedulerConfig } = require('../config/scheduler.config');
const { performanceConfig } = require('../config/performance.config');
const { SyncOrchestrator } = require('../application/sync/SyncOrchestrator');
const { resolveScheduledSections } = require('../config/catalog.config');
const { runCleanupJob } = require('./cleanup.job');
const { createLogger } = require('../infrastructure/logging/logger');
const { getMetrics } = require('../infrastructure/metrics/MetricsCollector');
const { getMemoryStats } = require('../utils/memory.util');

const logger = createLogger('scheduler');

/**
 * node-cron scheduler for catalog pipeline + cleanup.
 * Prevents overlapping pipeline runs; supports cancel flag for graceful shutdown.
 */
class PipelineScheduler {
  /**
   * @param {object} [options]
   */
  constructor(options = {}) {
    this.orchestrator = options.orchestrator || new SyncOrchestrator();
    this.cronExpression = options.cronExpression || schedulerConfig.cron;
    this.myanmarCronExpression = options.myanmarCronExpression || schedulerConfig.myanmarCron;
    this.myanmarSchedulerEnabled =
      options.myanmarSchedulerEnabled ?? schedulerConfig.myanmarEnabled;
    this.cleanupCron = options.cleanupCron || performanceConfig.cleanupCron;
    this.timezone = options.timezone || schedulerConfig.timezone;
    this.forceEnable = options.forceEnable === true;
    this.task = null;
    this.myanmarTask = null;
    this.cleanupTask = null;
    this.metricsTimer = null;
    this.running = false;
    this.cancelled = false;
    this._currentPromise = null;
  }

  start() {
    if (!schedulerConfig.enabled && !this.forceEnable) {
      logger.warn('Scheduler disabled via SCHEDULER_ENABLED=false');
      return this;
    }

    if (!cron.validate(this.cronExpression)) {
      throw new Error(`Invalid cron expression: ${this.cronExpression}`);
    }

    if (!this.task) {
      this.task = cron.schedule(
        this.cronExpression,
        () => {
          this.trigger('cron').catch((error) => {
            logger.error('Scheduled pipeline crashed', { message: error.message });
          });
        },
        { timezone: this.timezone },
      );
    }

    if (
      this.myanmarSchedulerEnabled &&
      cron.validate(this.myanmarCronExpression) &&
      !this.myanmarTask
    ) {
      this.myanmarTask = cron.schedule(
        this.myanmarCronExpression,
        () => {
          this.trigger('cron-myanmar', { sections: [SECTIONS.MYANMAR] }).catch((error) => {
            logger.error('Scheduled myanmar pipeline crashed', { message: error.message });
          });
        },
        { timezone: this.timezone },
      );
    }

    if (performanceConfig.cleanupEnabled && cron.validate(this.cleanupCron) && !this.cleanupTask) {
      this.cleanupTask = cron.schedule(
        this.cleanupCron,
        () => {
          runCleanupJob().catch((error) => {
            logger.error('Cleanup job crashed', { message: error.message });
          });
        },
        { timezone: this.timezone },
      );
    }

    if (performanceConfig.metricsEnabled && performanceConfig.metricsIntervalMs > 0 && !this.metricsTimer) {
      this.metricsTimer = setInterval(() => {
        if (performanceConfig.logMemory) {
          logger.info('Periodic metrics', getMetrics().snapshot({
            pipelineRunning: this.running,
          }));
        }
      }, performanceConfig.metricsIntervalMs);
      if (typeof this.metricsTimer.unref === 'function') {
        this.metricsTimer.unref();
      }
    }

    logger.info('Scheduler started', {
      cron: this.cronExpression,
      myanmarCron: this.myanmarSchedulerEnabled ? this.myanmarCronExpression : null,
      cleanupCron: this.cleanupCron,
      timezone: this.timezone,
      memory: getMemoryStats(),
    });
    return this;
  }

  /**
   * Request cancellation; in-flight pipeline finishes current section work but new triggers skip.
   */
  requestCancel() {
    this.cancelled = true;
    logger.warn('Scheduler cancel requested');
  }

  stop() {
    this.requestCancel();
    if (this.task) {
      this.task.stop();
      this.task = null;
    }
    if (this.myanmarTask) {
      this.myanmarTask.stop();
      this.myanmarTask = null;
    }
    if (this.cleanupTask) {
      this.cleanupTask.stop();
      this.cleanupTask = null;
    }
    if (this.metricsTimer) {
      clearInterval(this.metricsTimer);
      this.metricsTimer = null;
    }
    logger.info('Scheduler stopped');
  }

  /**
   * @param {string} [source]
   * @param {object} [options]
   */
  async trigger(source = 'manual', options = {}) {
    if (this.cancelled && (source === 'cron' || source === 'cron-myanmar')) {
      logger.warn('Skip cron trigger — cancelled', { source });
      return { skipped: true, reason: 'cancelled' };
    }

    if (this.running) {
      logger.warn('Pipeline already running; skip trigger', { source });
      getMetrics().incr('scheduler.overlap_skipped');
      return { skipped: true, reason: 'already_running' };
    }

    this.running = true;
    const started = Date.now();
    logger.info('Pipeline trigger', { source, sections: options.sections || 'all' });

    try {
      this._currentPromise = this.orchestrator.run({
        ...options,
        sequential: options.sequential ?? true,
        sections: options.sections || resolveScheduledSections(),
      });
      const report = await this._currentPromise;
      const durationMs = Date.now() - started;
      getMetrics().timing('scheduler.pipeline', durationMs);
      logger.info('Pipeline trigger finished', {
        source,
        durationMs,
        filesChanged: report.filesChanged?.length,
        filesUploaded: report.filesUploaded,
        errors: report.errors?.length,
        memory: getMemoryStats(),
      });
      return report;
    } finally {
      this._currentPromise = null;
      this.running = false;
    }
  }
}

module.exports = { PipelineScheduler };
