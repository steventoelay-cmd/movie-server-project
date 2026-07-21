'use strict';

/**
 * Jest global setup — isolate tests from developer .env production flags.
 */
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = process.env.LOG_LEVEL || 'error';
process.env.REQUIRE_API_KEY = 'false';
process.env.REQUIRE_ADMIN_KEY = 'false';
process.env.HEALTH_EXPOSE_METRICS = 'false';
process.env.CORS_ORIGIN = '*';

// Avoid accidental GitHub / heavy pipeline side effects
process.env.SCHEDULER_ENABLED = 'false';
