'use strict';

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const { securityConfig } = require('./config/security.config');
const { buildCorsOptions } = require('./middleware/corsOptions');
const { requestId } = require('./middleware/requestId');
const { responseTime } = require('./middleware/responseTime');
const { requestTimeout } = require('./middleware/requestTimeout');
const { notFound } = require('./middleware/notFound');
const { errorHandler } = require('./middleware/errorHandler');
const { mountRoutes } = require('./api/routes');
const { createLogger } = require('./infrastructure/logging/logger');

const securityLogger = createLogger('security');

/**
 * Build Express app with production security hardening.
 * Does not change Detail/Stream success response contracts.
 */
function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(requestId);
  app.use(responseTime);
  app.use(requestTimeout);

  app.use(
    helmet({
      contentSecurityPolicy: false, // JSON API — CSP not applicable to API responses
      crossOriginEmbedderPolicy: false,
      referrerPolicy: { policy: 'no-referrer' },
    }),
  );

  const corsOptions = buildCorsOptions();
  app.use(cors(corsOptions));
  app.options('*', cors(corsOptions));

  app.use(
    express.json({
      limit: securityConfig.request.jsonLimit,
      strict: true,
    }),
  );
  app.use(
    express.urlencoded({
      extended: false,
      limit: securityConfig.request.jsonLimit,
    }),
  );

  // Reject oversized URL query strings early
  app.use((req, res, next) => {
    const qs = req.url.includes('?') ? req.url.slice(req.url.indexOf('?') + 1) : '';
    if (qs.length > securityConfig.request.urlMaxLength + 64) {
      securityLogger.warn('Oversized query string rejected', {
        requestId: req.requestId,
        ip: req.ip,
        length: qs.length,
      });
      return res.status(414).json({
        error: {
          code: 'QUERY_TOO_LONG',
          message: 'Query string too long',
          requestId: req.requestId,
        },
      });
    }
    return next();
  });

  mountRoutes(app);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
