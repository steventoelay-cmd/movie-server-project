'use strict';

const { env } = require('./env');

const schedulerConfig = Object.freeze({
  enabled: env.scheduler.enabled,
  cron: env.scheduler.cron,
  timezone: env.scheduler.timezone,
  myanmarEnabled: env.scheduler.myanmarEnabled,
  myanmarCron: env.scheduler.myanmarCron,
});

module.exports = { schedulerConfig };
