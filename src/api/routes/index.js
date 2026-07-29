'use strict';

const express = require('express');
const detailRoutes = require('./detail.routes');
const streamRoutes = require('./stream.routes');
const healthRoutes = require('./health.routes');
const adminRoutes = require('./admin.routes');
const catalogRoutes = require('./catalog.routes');

function mountRoutes(app) {
  app.use('/health', healthRoutes);
  app.use('/detail', detailRoutes);
  app.use('/api/detail', detailRoutes);
  app.use('/stream', streamRoutes);
  app.use('/api/stream', streamRoutes);
  app.use('/catalog', catalogRoutes);
  app.use('/api/catalog', catalogRoutes);
  // Protected manual pipeline trigger (future JWT can reuse adminAuth)
  app.use('/admin', adminRoutes);
}

module.exports = { mountRoutes };
