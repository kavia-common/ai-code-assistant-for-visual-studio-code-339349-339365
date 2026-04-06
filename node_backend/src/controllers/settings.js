'use strict';

const { ValidationError } = require('../utils/errors');

class SettingsController {
  constructor({ store, log }) {
    this.store = store;
    this.log = log;
  }

  list(req, res) {
    const rows = this.store.listSettings();
    return res.status(200).json({ items: rows });
  }

  get(req, res) {
    const key = req.params.key;
    if (!key) throw new ValidationError('key is required');
    const row = this.store.getSetting(key);
    if (!row) return res.status(200).json({ key, value: null });
    return res.status(200).json(row);
  }

  upsert(req, res) {
    const key = req.params.key;
    if (!key) throw new ValidationError('key is required');
    const value = req.body && Object.prototype.hasOwnProperty.call(req.body, 'value') ? req.body.value : undefined;
    if (value === undefined) throw new ValidationError('body.value is required');
    const row = this.store.upsertSetting(key, value);
    this.log.info('setting_upserted', { key });
    return res.status(200).json(row);
  }
}

module.exports = {
  SettingsController,
};
