'use strict';

const { ValidationError } = require('../utils/errors');

class ConfirmationsController {
  constructor({ confirmationService, store }) {
    this.confirmationService = confirmationService;
    this.store = store;
  }

  get(req, res) {
    const id = req.params.confirmationId;
    if (!id) throw new ValidationError('confirmationId is required');
    const row = this.store.getConfirmation(id);
    if (!row) return res.status(404).json({ code: 'NOT_FOUND', message: 'Confirmation not found' });
    return res.status(200).json(row);
  }

  async decide(req, res) {
    const id = req.params.confirmationId;
    const { decision } = req.body || {};
    const updated = await this.confirmationService.decide({ confirmationId: id, decision });
    return res.status(200).json(updated);
  }
}

module.exports = {
  ConfirmationsController,
};
