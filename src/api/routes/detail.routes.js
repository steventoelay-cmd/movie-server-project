'use strict';

const express = require('express');
const { getDetail } = require('../controllers/detail.controller');
const { apiKeyAuth } = require('../../middleware/auth');
const { validateUrlQuery } = require('../../middleware/validateUrlQuery');
const { detailRateLimit } = require('../../middleware/securityRateLimits');

const router = express.Router();

router.get('/', apiKeyAuth, detailRateLimit, validateUrlQuery, getDetail);

module.exports = router;
