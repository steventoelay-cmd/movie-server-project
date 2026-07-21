'use strict';

/**
 * Backward-compatible re-export — prefer middleware/auth.js for new code.
 */
const { apiKeyAuth, adminAuth, createAuthMiddleware } = require('./auth');

module.exports = { apiKeyAuth, adminAuth, createAuthMiddleware };
