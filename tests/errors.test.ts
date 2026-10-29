import { describe, it, expect } from 'vitest';
import {
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  BusinessRuleError,
  formatErrorResponse,
} from '../src/lib/errors';

describe('Error Handling and RFC 7807 Compliance', () => {
  it('formats ValidationError into RFC 7807 problem details with invalidParams', () => {
    const error = new ValidationError('Invalid request payload', [
      { name: 'totalAmount', reason: 'Must be an exact INR decimal' },
    ]);

    const { status, body } = formatErrorResponse(error, {
      correlationId: 'test-correlation-123',
      instance: '/api/fees/payments',
    });

    expect(status).toBe(400);
    expect(body.status).toBe(400);
    expect(body.code).toBe('VALIDATION_ERROR');
    expect(body.title).toBe('Invalid Request Parameters');
    expect(body.correlationId).toBe('test-correlation-123');
    expect(body.instance).toBe('/api/fees/payments');
    expect(body.invalidParams).toHaveLength(1);
    expect(body.invalidParams?.[0].name).toBe('totalAmount');
  });

  it('formats AuthenticationError into 401 response', () => {
    const error = new AuthenticationError('Valid session token required');
    const { status, body } = formatErrorResponse(error);
    expect(status).toBe(401);
    expect(body.code).toBe('AUTHENTICATION_REQUIRED');
  });

  it('formats AuthorizationError into 403 response without leaking protected data', () => {
    const error = new AuthorizationError('You do not possess the required permission');
    const { status, body } = formatErrorResponse(error);
    expect(status).toBe(403);
    expect(body.code).toBe('FORBIDDEN');
  });

  it('formats BusinessRuleError into 422 response', () => {
    const error = new BusinessRuleError('Final fees receipt cannot be issued with outstanding dues');
    const { status, body } = formatErrorResponse(error);
    expect(status).toBe(422);
    expect(body.code).toBe('BUSINESS_RULE_VIOLATION');
  });

  it('safely handles untyped runtime exceptions without leaking internal secrets', () => {
    const rawError = new Error('Database password failed for user postgres:secret_pass_123');
    const { status, body } = formatErrorResponse(rawError, { correlationId: 'safe-corr-999' });

    expect(status).toBe(500);
    expect(body.status).toBe(500);
    expect(body.code).toBe('INTERNAL_SERVER_ERROR');
    // Ensure raw message with credentials is not in the public detail field
    expect(body.detail).not.toContain('secret_pass_123');
    expect(body.correlationId).toBe('safe-corr-999');
  });
});
