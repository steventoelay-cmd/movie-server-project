'use strict';

const express = require('express');
const { getStream } = require('../controllers/stream.controller');
const { apiKeyAuth } = require('../../middleware/auth');
const { validateUrlQuery } = require('../../middleware/validateUrlQuery');
const { streamRateLimit } = require('../../middleware/securityRateLimits');

const router = express.Router();

router.get('/', apiKeyAuth, streamRateLimit, validateUrlQuery, getStream);

module.exports = router;
