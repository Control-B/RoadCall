// Error handling utilities

import { ErrorType } from '@roadcall/types';

export class AppError extends Error {
  constructor(
    public type: ErrorType,
    public message: string,
    public code: string,
    public statusCode: number,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      error: {
        type: this.type,
        message: this.message,
        code: this.code,
        details: this.details,
        requestId: '', // Will be set by middleware
        timestamp: new Date().toISOString(),
      },
    };
  }
}

// Predefined error factories
export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(ErrorType.VALIDATION_ERROR, message, 'VALIDATION_ERROR', 400, details);
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication failed') {
    super(ErrorType.AUTHENTICATION_ERROR, message, 'AUTHENTICATION_ERROR', 401);
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Insufficient permissions') {
    super(ErrorType.AUTHORIZATION_ERROR, message, 'AUTHORIZATION_ERROR', 403);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    const message = id ? `${resource} with id ${id} not found` : `${resource} not found`;
    super(ErrorType.NOT_FOUND, message, 'NOT_FOUND', 404);
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(ErrorType.CONFLICT, message, 'CONFLICT', 409, details);
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = 'Rate limit exceeded') {
    super(ErrorType.RATE_LIMIT_EXCEEDED, message, 'RATE_LIMIT_EXCEEDED', 429);
  }
}

export class InternalError extends AppError {
  constructor(message: string = 'Internal server error', details?: Record<string, unknown>) {
    super(ErrorType.INTERNAL_ERROR, message, 'INTERNAL_ERROR', 500, details);
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(service: string) {
    super(
      ErrorType.SERVICE_UNAVAILABLE,
      `Service ${service} is unavailable`,
      'SERVICE_UNAVAILABLE',
      503
    );
  }
}

export class TimeoutError extends AppError {
  constructor(operation: string) {
    super(ErrorType.TIMEOUT, `Operation ${operation} timed out`, 'TIMEOUT', 504);
  }
}

// Business logic errors
export class IncidentAlreadyAssignedError extends AppError {
  constructor(incidentId: string) {
    super(
      ErrorType.INCIDENT_ALREADY_ASSIGNED,
      `Incident ${incidentId} is already assigned to a vendor`,
      'INCIDENT_ALREADY_ASSIGNED',
      409
    );
  }
}

export class VendorNotAvailableError extends AppError {
  constructor(vendorId: string) {
    super(
      ErrorType.VENDOR_NOT_AVAILABLE,
      `Vendor ${vendorId} is not available`,
      'VENDOR_NOT_AVAILABLE',
      409
    );
  }
}

export class PaymentFailedError extends AppError {
  constructor(reason: string, details?: Record<string, unknown>) {
    super(ErrorType.PAYMENT_FAILED, `Payment failed: ${reason}`, 'PAYMENT_FAILED', 402, details);
  }
}

export class FraudDetectedError extends AppError {
  constructor(details?: Record<string, unknown>) {
    super(
      ErrorType.FRAUD_DETECTED,
      'Transaction flagged for fraud',
      'FRAUD_DETECTED',
      403,
      details
    );
  }
}
