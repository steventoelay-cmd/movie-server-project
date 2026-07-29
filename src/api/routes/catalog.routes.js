'use strict';

const express = require('express');
const { getCatalogPage } = require('../controllers/catalog.controller');
const { apiKeyAuth } = require('../../middleware/auth');
const { detailRateLimit } = require('../../middleware/securityRateLimits');

const router = express.Router();

/** Load-more: flat sections (home, myanmar) */
router.get('/:section/page/:page', apiKeyAuth, detailRateLimit, getCatalogPage);

/** Load-more: parent index pages (v2 parent-list) */
router.get('/:section/parent/:page', apiKeyAuth, detailRateLimit, (req, res, next) => {
  req.query.parentIndex = 'true';
  return getCatalogPage(req, res, next);
});

/** Load-more: child pages under a parent id */
router.get('/:section/child/:parentId/page/:page', apiKeyAuth, detailRateLimit, getCatalogPage);

module.exports = router;
