'use strict';

const express = require('express');
const { getLoadMore } = require('../controllers/catalog.controller');
const { apiKeyAuth } = require('../../middleware/auth');
const { detailRateLimit } = require('../../middleware/securityRateLimits');

const router = express.Router();

/**
 * Load-more (page 4+): SSD cache → live scrape one page → SSD → JSON.
 * Query: section, page, parentId?, parentUrl?
 */
router.get('/', apiKeyAuth, detailRateLimit, getLoadMore);

module.exports = router;
