'use strict';

const express = require('express');
const { apiKeyAuth } = require('../../middleware/auth');
const { detailRateLimit } = require('../../middleware/securityRateLimits');
const {
  getParentIndex,
  getFlatPage,
  getChildPage,
  getVersionJson,
} = require('../controllers/catalogCdn.controller');

const router = express.Router();

/** Same paths as GitHub raw JSON (Flutter catalogDio). Requires X-Api-Key when API_KEY is set. */
router.get('/version.json', apiKeyAuth, detailRateLimit, getVersionJson);
router.get('/:folder/index.json', apiKeyAuth, detailRateLimit, getParentIndex);
router.get(
  '/:folder/:parentId/page-:page.json',
  apiKeyAuth,
  detailRateLimit,
  getChildPage,
);
router.get('/:folder/page-:page.json', apiKeyAuth, detailRateLimit, getFlatPage);

module.exports = router;
