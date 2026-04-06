'use strict';

const { ConfirmationRequiredError, NotFoundError, ValidationError } = require('../utils/errors');

class ConfirmationService {
  constructor({ store, log }) {
    this.store = store;
    this.log = log;
  }

  // PUBLIC_INTERFACE
  async requireConfirmation({ operation, scope = null, request, expiresInMs = 10 * 60 * 1000 }) {
    /**
     * PUBLIC_INTERFACE
     * Create a confirmation and throw ConfirmationRequiredError for API boundary mapping.
     *
     * Contract:
     * - Inputs: operation (string), request (object), optional scope, expiresInMs
     * - Output: never returns normally; throws ConfirmationRequiredError
     * - Side effects: inserts a row in safety_confirmations
     */
    if (!operation) throw new ValidationError('operation is required');
    if (!request || typeof request !== 'object') throw new ValidationError('request must be an object');

    const expiresAtMs = Date.now() + expiresInMs;
    const confirmation = this.store.createConfirmation({ operation, scope, request, expiresAtMs });
    this.log.warn('confirmation_required', { operation, scope, confirmationId: confirmation.id });
    throw new ConfirmationRequiredError('User confirmation required', {
      confirmationId: confirmation.id,
      operation,
      request,
    });
  }

  // PUBLIC_INTERFACE
  async decide({ confirmationId, decision }) {
    /**
     * PUBLIC_INTERFACE
     * Decide a pending confirmation.
     */
    if (!confirmationId) throw new ValidationError('confirmationId is required');
    if (!['approved', 'rejected'].includes(decision)) {
      throw new ValidationError('decision must be approved|rejected');
    }
    const existing = this.store.getConfirmation(confirmationId);
    if (!existing) throw new NotFoundError('Confirmation not found', { confirmationId });
    const updated = this.store.decideConfirmation(confirmationId, decision);
    this.log.info('confirmation_decided', { confirmationId, decision });
    return updated;
  }
}

module.exports = {
  ConfirmationService,
};
