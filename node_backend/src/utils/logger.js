'use strict';

/**
 * Minimal structured logger.
 * We keep it intentionally lightweight (console-based) but consistent and searchable.
 */

function _nowIso() {
  return new Date().toISOString();
}

function _safeJson(obj) {
  try {
    return JSON.stringify(obj);
  } catch {
    return '"[unserializable]"';
  }
}

function _log(level, message, meta) {
  const line = {
    ts: _nowIso(),
    level,
    message,
    ...(meta ? { meta } : {}),
  };
  console.log(_safeJson(line));
}

// PUBLIC_INTERFACE
function child(baseMeta) {
  /**
   * PUBLIC_INTERFACE
   * Create a child logger with predefined metadata.
   */
  return {
    info: (message, meta) => _log('info', message, { ...baseMeta, ...(meta || {}) }),
    warn: (message, meta) => _log('warn', message, { ...baseMeta, ...(meta || {}) }),
    error: (message, meta) => _log('error', message, { ...baseMeta, ...(meta || {}) }),
    debug: (message, meta) => _log('debug', message, { ...baseMeta, ...(meta || {}) }),
  };
}

const logger = child({});

module.exports = {
  logger,
  child,
};
