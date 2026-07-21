'use strict';

const express = require('express');
const { triggerPipeline } = require('../controllers/admin.controller');
const { adminAuth } = require('../../middleware/auth');
const { adminRateLimit } = require('../../middleware/securityRateLimits');

const router = express.Router();

/**
 * POST /admin/pipeline
 * Body/query: { sections?: string|string[], upload?: boolean }
 * Protected — prevents unauthorized scheduler/manual execution.
 */
router.post('/pipeline', adminAuth, adminRateLimit, triggerPipeline);

module.exports = router;
