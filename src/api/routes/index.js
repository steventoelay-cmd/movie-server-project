'use strict';

const express = require('express');
const detailRoutes = require('./detail.routes');
const streamRoutes = require('./stream.routes');
const healthRoutes = require('./health.routes');
const adminRoutes = require('./admin.routes');

function mountRoutes(app) {
  app.use('/health', healthRoutes);
  app.use('/detail', detailRoutes);
  app.use('/api/detail', detailRoutes);
  app.use('/stream', streamRoutes);
  app.use('/api/stream', streamRoutes);
  // Protected manual pipeline trigger (future JWT can reuse adminAuth)
  app.use('/admin', adminRoutes);
}

module.exports = { mountRoutes };
