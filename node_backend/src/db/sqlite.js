'use strict';

const Database = require('better-sqlite3');
const { v4: uuidv4 } = require('uuid');
const { logger } = require('../utils/logger');

function _utcMs() {
  return Date.now();
}

function _jsonParseOrNull(s) {
  if (!s) return null;
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

/**
 * Apply minimal schema safety checks.
 * We rely on sqlite_database migrations having run; this is a defensive check.
 */
function _validateExpectedTables(db) {
  const rows = db
    .prepare(
      'SELECT name FROM sqlite_master WHERE type=\'table\' AND name NOT LIKE \'sqlite_%\' ORDER BY name;'
    )
    .all();
  const tables = new Set(rows.map((r) => r.name));
  const expected = [
    'settings',
    'provider_configs',
    'chat_sessions',
    'chat_messages',
    'safety_confirmations',
    'telemetry_preferences',
  ];
  for (const t of expected) {
    if (!tables.has(t)) {
      throw new Error(`SQLite schema missing expected table: ${t}`);
    }
  }
}

/**
 * SQLiteStore encapsulates all DB queries for backend flows.
 * One canonical place for persistence = less patchy long-term behavior.
 */
class SQLiteStore {
  constructor(dbPath) {
    this.dbPath = dbPath;
    this.db = new Database(dbPath);
    // Ensure FK constraints.
    this.db.pragma('foreign_keys = ON');
    // WAL best effort.
    try {
      this.db.pragma('journal_mode = WAL');
    } catch {
      // ignore
    }
    _validateExpectedTables(this.db);
  }

  close() {
    this.db.close();
  }

  // Settings
  getSetting(key) {
    const row = this.db
      .prepare('SELECT key, value_json, updated_at_ms FROM settings WHERE key = ?')
      .get(key);
    if (!row) return null;
    return { key: row.key, value: _jsonParseOrNull(row.value_json), updatedAtMs: row.updated_at_ms };
  }

  upsertSetting(key, value) {
    const now = _utcMs();
    this.db
      .prepare(
        `
        INSERT INTO settings(key, value_json, updated_at_ms)
        VALUES (?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET
          value_json = excluded.value_json,
          updated_at_ms = excluded.updated_at_ms;
      `
      )
      .run(key, JSON.stringify(value), now);
    return this.getSetting(key);
  }

  listSettings() {
    const rows = this.db
      .prepare('SELECT key, value_json, updated_at_ms FROM settings ORDER BY key ASC')
      .all();
    return rows.map((r) => ({
      key: r.key,
      value: _jsonParseOrNull(r.value_json),
      updatedAtMs: r.updated_at_ms,
    }));
  }

  // Provider configs (non-secret metadata only)
  listProviderConfigs() {
    const rows = this.db
      .prepare(
        `
        SELECT id, provider_type, display_name, base_url, model_default, extra_json,
               is_enabled, created_at_ms, updated_at_ms
        FROM provider_configs
        ORDER BY created_at_ms ASC;
      `
      )
      .all();
    return rows.map((r) => ({
      id: r.id,
      providerType: r.provider_type,
      displayName: r.display_name,
      baseUrl: r.base_url,
      modelDefault: r.model_default,
      extra: _jsonParseOrNull(r.extra_json) || {},
      isEnabled: !!r.is_enabled,
      createdAtMs: r.created_at_ms,
      updatedAtMs: r.updated_at_ms,
    }));
  }

  getProviderConfig(id) {
    const row = this.db
      .prepare(
        `
        SELECT id, provider_type, display_name, base_url, model_default, extra_json,
               is_enabled, created_at_ms, updated_at_ms
        FROM provider_configs
        WHERE id = ?;
      `
      )
      .get(id);
    if (!row) return null;
    return {
      id: row.id,
      providerType: row.provider_type,
      displayName: row.display_name,
      baseUrl: row.base_url,
      modelDefault: row.model_default,
      extra: _jsonParseOrNull(row.extra_json) || {},
      isEnabled: !!row.is_enabled,
      createdAtMs: row.created_at_ms,
      updatedAtMs: row.updated_at_ms,
    };
  }

  upsertProviderConfig(config) {
    const now = _utcMs();
    const id = config.id || uuidv4();
    this.db
      .prepare(
        `
        INSERT INTO provider_configs(
          id, provider_type, display_name, base_url, model_default, extra_json,
          is_enabled, created_at_ms, updated_at_ms
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          provider_type = excluded.provider_type,
          display_name = excluded.display_name,
          base_url = excluded.base_url,
          model_default = excluded.model_default,
          extra_json = excluded.extra_json,
          is_enabled = excluded.is_enabled,
          updated_at_ms = excluded.updated_at_ms;
      `
      )
      .run(
        id,
        config.providerType,
        config.displayName,
        config.baseUrl || null,
        config.modelDefault || null,
        JSON.stringify(config.extra || {}),
        config.isEnabled === false ? 0 : 1,
        now,
        now
      );
    return this.getProviderConfig(id);
  }

  // Sessions / messages
  createSession({ title = null, providerConfigId = null } = {}) {
    const now = _utcMs();
    const id = uuidv4();
    this.db
      .prepare(
        `
        INSERT INTO chat_sessions(id, title, provider_config_id, created_at_ms, updated_at_ms)
        VALUES (?, ?, ?, ?, ?);
      `
      )
      .run(id, title, providerConfigId, now, now);
    return this.getSession(id);
  }

  listSessions({ limit = 50, offset = 0 } = {}) {
    const rows = this.db
      .prepare(
        `
        SELECT id, title, provider_config_id, created_at_ms, updated_at_ms
        FROM chat_sessions
        ORDER BY updated_at_ms DESC
        LIMIT ? OFFSET ?;
      `
      )
      .all(limit, offset);
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      providerConfigId: r.provider_config_id,
      createdAtMs: r.created_at_ms,
      updatedAtMs: r.updated_at_ms,
    }));
  }

  getSession(id) {
    const row = this.db
      .prepare(
        `
        SELECT id, title, provider_config_id, created_at_ms, updated_at_ms
        FROM chat_sessions
        WHERE id = ?;
      `
      )
      .get(id);
    if (!row) return null;
    return {
      id: row.id,
      title: row.title,
      providerConfigId: row.provider_config_id,
      createdAtMs: row.created_at_ms,
      updatedAtMs: row.updated_at_ms,
    };
  }

  addMessage({ sessionId, role, content, contentJson = null }) {
    const now = _utcMs();
    const id = uuidv4();
    this.db
      .prepare(
        `
        INSERT INTO chat_messages(id, session_id, role, content, content_json, created_at_ms)
        VALUES (?, ?, ?, ?, ?, ?);
      `
      )
      .run(id, sessionId, role, content, contentJson ? JSON.stringify(contentJson) : null, now);

    this.db.prepare('UPDATE chat_sessions SET updated_at_ms = ? WHERE id = ?').run(now, sessionId);
    return this.getMessage(id);
  }

  getMessage(id) {
    const row = this.db
      .prepare(
        `
        SELECT id, session_id, role, content, content_json, created_at_ms
        FROM chat_messages
        WHERE id = ?;
      `
      )
      .get(id);
    if (!row) return null;
    return {
      id: row.id,
      sessionId: row.session_id,
      role: row.role,
      content: row.content,
      contentJson: _jsonParseOrNull(row.content_json),
      createdAtMs: row.created_at_ms,
    };
  }

  listMessages(sessionId, { limit = 200, offset = 0 } = {}) {
    const rows = this.db
      .prepare(
        `
        SELECT id, session_id, role, content, content_json, created_at_ms
        FROM chat_messages
        WHERE session_id = ?
        ORDER BY created_at_ms ASC
        LIMIT ? OFFSET ?;
      `
      )
      .all(sessionId, limit, offset);
    return rows.map((r) => ({
      id: r.id,
      sessionId: r.session_id,
      role: r.role,
      content: r.content,
      contentJson: _jsonParseOrNull(r.content_json),
      createdAtMs: r.created_at_ms,
    }));
  }

  // Confirmations
  createConfirmation({ operation, scope = null, request, expiresAtMs = null }) {
    const now = _utcMs();
    const id = uuidv4();
    this.db
      .prepare(
        `
        INSERT INTO safety_confirmations(
          id, operation, scope, request_json, decision, decided_at_ms, expires_at_ms, created_at_ms
        )
        VALUES (?, ?, ?, ?, 'expired', 0, ?, ?);
      `
      )
      .run(id, operation, scope, JSON.stringify(request), expiresAtMs, now);
    return this.getConfirmation(id);
  }

  getConfirmation(id) {
    const row = this.db
      .prepare(
        `
        SELECT id, operation, scope, request_json, decision, decided_at_ms, expires_at_ms, created_at_ms
        FROM safety_confirmations
        WHERE id = ?;
      `
      )
      .get(id);
    if (!row) return null;
    return {
      id: row.id,
      operation: row.operation,
      scope: row.scope,
      request: _jsonParseOrNull(row.request_json),
      decision: row.decision,
      decidedAtMs: row.decided_at_ms,
      expiresAtMs: row.expires_at_ms,
      createdAtMs: row.created_at_ms,
    };
  }

  decideConfirmation(id, decision) {
    const now = _utcMs();
    this.db
      .prepare(
        `
        UPDATE safety_confirmations
        SET decision = ?, decided_at_ms = ?
        WHERE id = ?;
      `
      )
      .run(decision, now, id);
    return this.getConfirmation(id);
  }

  // Telemetry pref
  getTelemetryPreference() {
    const row = this.db
      .prepare('SELECT is_opted_in, updated_at_ms FROM telemetry_preferences WHERE id = 1')
      .get();
    if (!row) return { isOptedIn: false, updatedAtMs: 0 };
    return { isOptedIn: !!row.is_opted_in, updatedAtMs: row.updated_at_ms };
  }

  setTelemetryPreference(isOptedIn) {
    const now = _utcMs();
    this.db
      .prepare(
        `
        INSERT INTO telemetry_preferences(id, is_opted_in, updated_at_ms)
        VALUES (1, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          is_opted_in = excluded.is_opted_in,
          updated_at_ms = excluded.updated_at_ms;
      `
      )
      .run(isOptedIn ? 1 : 0, now);
    logger.info('telemetry_preference_updated', { isOptedIn });
    return this.getTelemetryPreference();
  }
}

module.exports = {
  SQLiteStore,
};
