'use strict';

/**
 * Centralized runtime configuration loader.
 *
 * Contract:
 * - Inputs: process.env (read once here)
 * - Outputs: plain JS config object
 * - Errors: throws Error for missing required env vars
 * - Side effects: none
 */

function _parseBool(v, defaultValue) {
  if (v === undefined || v === null || v === '') return defaultValue;
  return String(v).toLowerCase() === 'true' || String(v) === '1';
}

function _parseCsv(v, defaultValue) {
  if (!v) return defaultValue;
  return String(v)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

// PUBLIC_INTERFACE
function loadConfig(env = process.env) {
  /**
   * PUBLIC_INTERFACE
   * Load validated configuration.
   */
  const config = {
    nodeEnv: env.NODE_ENV || 'development',
    host: env.HOST || '0.0.0.0',
    port: Number(env.PORT || 3001),

    // CORS
    allowedOrigins: _parseCsv(env.ALLOWED_ORIGINS, ['*']),
    allowedHeaders: _parseCsv(env.ALLOWED_HEADERS, ['Content-Type', 'Authorization']),
    allowedMethods: _parseCsv(env.ALLOWED_METHODS, ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS']),
    corsMaxAge: Number(env.CORS_MAX_AGE || 3600),

    // DB (from sqlite_database container)
    sqliteDbPath: env.SQLITE_DB,

    // Request controls
    requestTimeoutMs: Number(env.REQUEST_TIMEOUT_MS || 30000),

    // Telemetry
    telemetryEnabledByDefault: _parseBool(env.TELEMETRY_ENABLED_BY_DEFAULT, false),

    // Provider
    defaultProviderId: env.DEFAULT_PROVIDER_ID || 'local_stub',
  };

  if (!config.sqliteDbPath) {
    throw new Error(
      'Missing required env var SQLITE_DB (path to sqlite_database/myapp.db).'
    );
  }

  return config;
}

module.exports = {
  loadConfig,
};
