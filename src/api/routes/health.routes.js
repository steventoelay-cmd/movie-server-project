'use strict';

const express = require('express');
const { getHealth } = require('../controllers/health.controller');
const { healthRateLimit } = require('../../middleware/securityRateLimits');

const router = express.Router();

router.get('/', healthRateLimit, getHealth);

module.exports = router;
