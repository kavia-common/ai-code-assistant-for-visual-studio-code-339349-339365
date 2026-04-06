'use strict';

const { ValidationError } = require('../utils/errors');

class TelemetryController {
  constructor({ store, log }) {
    this.store = store;
    this.log = log;
  }

  getPreference(req, res) {
    const pref = this.store.getTelemetryPreference();
    return res.status(200).json(pref);
  }

  setPreference(req, res) {
    const { isOptedIn } = req.body || {};
    if (typeof isOptedIn !== 'boolean') {
      throw new ValidationError('isOptedIn must be boolean');
    }
    const pref = this.store.setTelemetryPreference(isOptedIn);
    this.log.info('telemetry_opt_in_updated', { isOptedIn });
    return res.status(200).json(pref);
  }
}

module.exports = {
  TelemetryController,
};
