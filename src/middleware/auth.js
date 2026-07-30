'use strict';

const { securityConfig } = require('../config/security.config');
const { createLogger } = require('../infrastructure/logging/logger');

const securityLogger = createLogger('security');

/**
 * Authentication middleware — API key today; JWT/OAuth hooks later without rewriting controllers.
 *
 * Modes:
 * - public: no auth
 * - apiKey: require X-Api-Key when configured / required
 * - admin: require ADMIN_API_KEY (scheduler/manual triggers)
 */
function createAuthMiddleware(mode = 'apiKey') {
  return function authMiddleware(req, res, next) {
    if (mode === 'public') {
      return next();
    }

    if (mode === 'admin') {
      if (!securityConfig.requireAdminKey && !securityConfig.adminApiKey) {
        // No admin key configured — deny admin routes by default in production
        if (securityConfig.isProduction) {
          securityLogger.warn('Admin route blocked — ADMIN_API_KEY not configured', {
            requestId: req.requestId,
            ip: req.ip,
            path: req.originalUrl,
          });
          return res.status(401).json({
            error: {
              code: 'ADMIN_AUTH_REQUIRED',
              message: 'Admin authentication is not configured',
              requestId: req.requestId,
            },
          });
        }
        return next();
      }
      const key = req.headers['x-admin-key'] || req.headers['x-api-key'];
      if (!securityConfig.adminApiKey || key !== securityConfig.adminApiKey) {
        securityLogger.warn('Admin authentication failure', {
          requestId: req.requestId,
          ip: req.ip,
          path: req.originalUrl,
        });
        return res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Invalid or missing admin credentials',
            requestId: req.requestId,
          },
        });
      }
      req.auth = { type: 'admin', roles: ['admin'] };
      return next();
    }

    // apiKey mode (Detail/Stream)
    const configured = process.env.API_KEY || '';
    if (!configured) {
      if (securityConfig.requireApiKey) {
        securityLogger.error('API_KEY required but missing', { requestId: req.requestId });
        return res.status(503).json({
          error: {
            code: 'AUTH_NOT_CONFIGURED',
            message: 'API authentication is required but not configured',
            requestId: req.requestId,
          },
        });
      }
      return next();
    }

    const key = req.headers['x-api-key'];
    if (key !== configured) {
      securityLogger.warn('API key authentication failure', {
        requestId: req.requestId,
        ip: req.ip,
        path: req.originalUrl,
      });
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid or missing API key',
          requestId: req.requestId,
        },
      });
    }

    req.auth = { type: 'apiKey', roles: ['client'] };
    // Future: JWT — parse Authorization Bearer and set req.auth.userId / roles
    return next();
  };
}

const apiKeyAuth = createAuthMiddleware('apiKey');
const adminAuth = createAuthMiddleware('admin');
const publicAuth = createAuthMiddleware('public');

module.exports = {
  createAuthMiddleware,
  apiKeyAuth,
  adminAuth,
  publicAuth,
};
