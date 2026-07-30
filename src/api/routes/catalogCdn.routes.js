'use strict';

const express = require('express');
const { publicAuth } = require('../../middleware/auth');
const { detailRateLimit } = require('../../middleware/securityRateLimits');
const {
  getParentIndex,
  getFlatPage,
  getChildPage,
  getVersionJson,
} = require('../controllers/catalogCdn.controller');

const router = express.Router();

/** Same paths as GitHub raw JSON (Flutter catalogDio). Public read, rate-limited. */
router.get('/version.json', publicAuth, detailRateLimit, getVersionJson);
router.get('/:folder/index.json', publicAuth, detailRateLimit, getParentIndex);
router.get(
  '/:folder/:parentId/page-:page.json',
  publicAuth,
  detailRateLimit,
  getChildPage,
);
router.get('/:folder/page-:page.json', publicAuth, detailRateLimit, getFlatPage);

module.exports = router;
