import { ApiErrorResponse, IsoTimestampString } from '../modules/shared/types';
import { getOrCreateCorrelationId } from './correlation';
import { logger } from './logger';

export abstract class AppError extends Error {
  abstract readonly statusCode: number;
  abstract readonly code: string;
  abstract readonly title: string;
  readonly detail: string;
  readonly invalidParams?: Array<{ name: string; reason: string }>;

  constructor(detail: string, invalidParams?: Array<{ name: string; reason: string }>) {
    super(detail);
    this.name = this.constructor.name;
    this.detail = detail;
    this.invalidParams = invalidParams;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ValidationError extends AppError {
  readonly statusCode = 400;
  readonly code = 'VALIDATION_ERROR';
  readonly title = 'Invalid Request Parameters';
}

export class AuthenticationError extends AppError {
  readonly statusCode = 401;
  readonly code = 'AUTHENTICATION_REQUIRED';
  readonly title = 'Authentication Required';
}

export class AuthorizationError extends AppError {
  readonly statusCode = 403;
  readonly code = 'FORBIDDEN';
  readonly title = 'Access Denied';
}

export class NotFoundError extends AppError {
  readonly statusCode = 404;
  readonly code = 'NOT_FOUND';
  readonly title = 'Resource Not Found';
}

export class ConflictError extends AppError {
  readonly statusCode = 409;
  readonly code = 'CONFLICT';
  readonly title = 'Resource Conflict';
}

export class BusinessRuleError extends AppError {
  readonly statusCode = 422;
  readonly code: string = 'BUSINESS_RULE_VIOLATION';
  readonly title = 'Business Rule Violation';

  constructor(
    detail: string,
    code?: string,
    invalidParams?: Array<{ name: string; reason: string }>
  ) {
    super(detail, invalidParams);
    if (code) {
      this.code = code;
    }
  }
}

export class InternalServerError extends AppError {
  readonly statusCode = 500;
  readonly code = 'INTERNAL_SERVER_ERROR';
  readonly title = 'An Unexpected Server Error Occurred';
}

/**
 * Standard RFC 7807 problem details converter.
 * Guarantees that internal database details and secrets are not leaked in error bodies.
 */
export function formatErrorResponse(
  error: unknown,
  options?: {
    correlationId?: string;
    instance?: string;
    reqHeaders?: Headers | Record<string, string | string[] | undefined>;
  }
): { status: number; body: ApiErrorResponse } {
  const correlationId = options?.correlationId || getOrCreateCorrelationId(options?.reqHeaders);
  const instance = options?.instance || '/api';
  const timestamp: IsoTimestampString = new Date().toISOString();

  if (error instanceof AppError) {
    if (error.statusCode >= 500) {
      logger.error(`Server error: ${error.message}`, { correlationId, instance }, error);
    } else {
      logger.warn(`Client error [${error.code}]: ${error.detail}`, { correlationId, instance });
    }

    return {
      status: error.statusCode,
      body: {
        type: `https://school.portal.local/errors/${error.code.toLowerCase().replace(/_/g, '-')}`,
        title: error.title,
        status: error.statusCode,
        code: error.code,
        detail: error.detail,
        instance,
        correlationId,
        timestamp,
        invalidParams: error.invalidParams,
      },
    };
  }

  // Handle unhandled unexpected exceptions safely
  const err = error instanceof Error ? error : new Error(String(error));
  logger.error(`Unhandled exception: ${err.message}`, { correlationId, instance }, err);

  return {
    status: 500,
    body: {
      type: 'https://school.portal.local/errors/internal-server-error',
      title: 'Internal Server Error',
      status: 500,
      code: 'INTERNAL_SERVER_ERROR',
      detail: 'An unexpected internal error occurred. Please quote the correlation ID when contacting support.',
      instance,
      correlationId,
      timestamp,
    },
  };
}
