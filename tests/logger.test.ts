import { describe, it, expect } from 'vitest';
import { redactSensitiveData } from '../src/lib/logger';

describe('Structured Logger & Secret Redaction (AUDIT_LOGGING.md)', () => {
  it('redacts sensitive password and token fields', () => {
    const payload = {
      email: 'officer@school.local',
      password: 'SuperSecretPassword123!',
      token: 'jwt.token.value',
      user: {
        role: 'admission_officer',
        service_role_key: 'sb_secret_key',
      },
    };

    const redacted = redactSensitiveData(payload) as Record<string, unknown>;
    expect(redacted.email).toBe('officer@school.local');
    expect(redacted.password).toBe('[REDACTED]');
    expect(redacted.token).toBe('[REDACTED]');
    expect((redacted.user as Record<string, unknown>).service_role_key).toBe('[REDACTED]');
    expect((redacted.user as Record<string, unknown>).role).toBe('admission_officer');
  });

  it('redacts Aadhaar numbers in demographic context', () => {
    const payload = {
      studentName: 'Rohan Sharma',
      aadhaar_number: '123456789012',
      details: {
        aadhaar: '987654321098',
        household_income_inr: '450000.00',
        caste_category: 'General',
      },
    };

    const redacted = redactSensitiveData(payload) as Record<string, unknown>;
    expect(redacted.aadhaar_number).toBe('[REDACTED]');
    expect((redacted.details as Record<string, unknown>).aadhaar).toBe('[REDACTED]');
    expect((redacted.details as Record<string, unknown>).household_income_inr).toBe('[REDACTED]');
    expect((redacted.details as Record<string, unknown>).caste_category).toBe('[REDACTED]');
  });

  it('redacts database passwords in connection strings', () => {
    const uri = 'postgresql://postgres:mysecretpassword123@127.0.0.1:54322/postgres';
    const redacted = redactSensitiveData(uri);
    expect(redacted).toBe('postgresql://[REDACTED_USER]:[REDACTED_PASSWORD]@127.0.0.1:54322/postgres');
  });
});
