'use strict';

const { securityConfig } = require('./security.config');
const { githubConfig } = require('./github.config');
const { createLogger } = require('../infrastructure/logging/logger');

const logger = createLogger('env-validate');

/**
 * Validate environment at startup. Fail gracefully with clear messages.
 * Does not print secret values.
 * @param {object} [options]
 * @param {boolean} [options.strict] - treat warnings as fatal
 * @returns {{ ok: boolean, errors: string[], warnings: string[] }}
 */
function validateEnv(options = {}) {
  const strict = options.strict ?? securityConfig.isProduction;
  const errors = [];
  const warnings = [];

  if (securityConfig.requireApiKey && !process.env.API_KEY) {
    errors.push('API_KEY is required when REQUIRE_API_KEY=true (or NODE_ENV=production)');
  }

  if (securityConfig.requireAdminKey && !process.env.ADMIN_API_KEY) {
    errors.push('ADMIN_API_KEY is required when REQUIRE_ADMIN_KEY=true');
  }

  const corsOrigins = securityConfig.cors.origins;
  if (
    securityConfig.isProduction &&
    corsOrigins.includes('*') &&
    !securityConfig.cors.allowWildcardInProduction
  ) {
    errors.push(
      'CORS_ORIGIN=* is not allowed in production unless CORS_ALLOW_WILDCARD_IN_PRODUCTION=true',
    );
  }

  if (process.env.GITHUB_TOKEN && (!githubConfig.owner || !githubConfig.repo)) {
    warnings.push('GITHUB_TOKEN is set but GITHUB_OWNER/GITHUB_REPO are incomplete — uploads will fail');
  }

  if (!process.env.GITHUB_TOKEN && securityConfig.isProduction) {
    warnings.push('GITHUB_TOKEN not set — catalog sync will run local-only');
  }

  const port = Number(process.env.PORT || 3000);
  if (!Number.isFinite(port) || port < 1 || port > 65535) {
    errors.push('PORT must be a valid TCP port (1-65535)');
  }

  for (const w of warnings) {
    logger.warn(w);
  }
  for (const e of errors) {
    logger.error(e);
  }

  if (errors.length && strict) {
    const err = new Error(`Environment validation failed:\n- ${errors.join('\n- ')}`);
    err.code = 'ENV_VALIDATION_FAILED';
    throw err;
  }

  return { ok: errors.length === 0, errors, warnings };
}

module.exports = { validateEnv };
