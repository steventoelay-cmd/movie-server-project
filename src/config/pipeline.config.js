'use strict';

const path = require('path');
const { env } = require('./env');

const rootDir = path.resolve(__dirname, '../..');

const pipelineConfig = Object.freeze({
  pageSize: env.pipeline.pageSize,
  maxHomePages: env.pipeline.maxHomePages,
  maxMyanmarPages: env.pipeline.maxMyanmarPages,
  maxParentPages: env.pipeline.maxParentPages,
  maxChildPages: env.pipeline.maxChildPages,
  maxParentsPerRun: env.pipeline.maxParentsPerRun,
  githubCdnPages: env.pipeline.githubCdnPages,
  loadMoreMinPage: env.pipeline.loadMoreMinPage,
  outputDir: path.resolve(rootDir, env.pipeline.outputDir),
  previousDir: path.resolve(rootDir, env.pipeline.previousDir),
  refuseEmptyOverwrite: env.pipeline.refuseEmptyOverwrite,
  schemaVersion: env.pipeline.schemaVersion,
  generatorVersion: env.pipeline.generatorVersion,
  sectionSites: Object.freeze({
    home: env.sections.homeSite,
    model: env.sections.modelSite,
    channel: env.sections.channelSite,
    tag: env.sections.tagSite,
    myanmar: env.sections.myanmarSite,
  }),
  /** Flutter-facing folder names */
  sectionFolders: Object.freeze({
    home: 'home',
    model: 'models',
    channel: 'channels',
    tag: 'tags',
    myanmar: 'myanmar',
  }),
});

module.exports = { pipelineConfig, rootDir };
