'use strict';

class AppError extends Error {
  constructor(message, { code = 'APP_ERROR', status = 500, details = null } = {}) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

class ValidationError extends AppError {
  constructor(message, details = null) {
    super(message, { code: 'VALIDATION_ERROR', status: 400, details });
    this.name = 'ValidationError';
  }
}

class NotFoundError extends AppError {
  constructor(message, details = null) {
    super(message, { code: 'NOT_FOUND', status: 404, details });
    this.name = 'NotFoundError';
  }
}

class ConfirmationRequiredError extends AppError {
  constructor(message, { confirmationId, operation, request } = {}) {
    super(message, {
      code: 'CONFIRMATION_REQUIRED',
      status: 409,
      details: { confirmationId, operation, request },
    });
    this.name = 'ConfirmationRequiredError';
  }
}

module.exports = {
  AppError,
  ValidationError,
  NotFoundError,
  ConfirmationRequiredError,
};
