import { describe, it, expect } from 'vitest';
import { enforcePolicy } from '../src/policy/guards';
import { hasPermission } from '../src/policy/permissions';
import { AuthorizationError } from '../src/lib/errors';
import { requireRole } from '../src/auth/guards';

describe('Centralized RBAC Enforcement (AUTHORIZATION_MATRIX.md)', () => {
  describe('Principal Authority (Business Signatory)', () => {
    it('grants full business approval authority', () => {
      expect(hasPermission('principal', 'admissions:approve_decision')).toBe(true);
      expect(hasPermission('principal', 'fees:approve_concession')).toBe(true);
      expect(hasPermission('principal', 'fees:approve_reversal')).toBe(true);
      expect(hasPermission('principal', 'fees:approve_structure')).toBe(true);
      expect(hasPermission('principal', 'certificates:issue_tc')).toBe(true);
      expect(hasPermission('principal', 'admissions:view_sensitive_pii')).toBe(true);
    });

    it('denies verification submission (assigned to Admission Officer per workflow)', () => {
      expect(hasPermission('principal', 'admissions:submit_verification')).toBe(false);
      expect(() => enforcePolicy('principal', 'admissions:submit_verification')).toThrow(AuthorizationError);
    });
  });

  describe('Admission Officer Authority (Demographics & Verification)', () => {
    it('permits sensitive PII access strictly within authorized admission intake function', () => {
      expect(hasPermission('admission_officer', 'admissions:view_sensitive_pii')).toBe(true);
      expect(hasPermission('admission_officer', 'admissions:create_draft')).toBe(true);
      expect(hasPermission('admission_officer', 'admissions:submit_verification')).toBe(true);
    });

    it('denies business decision approvals (Principal only)', () => {
      expect(hasPermission('admission_officer', 'admissions:approve_decision')).toBe(false);
      expect(hasPermission('admission_officer', 'fees:approve_concession')).toBe(false);
      expect(hasPermission('admission_officer', 'certificates:issue_tc')).toBe(false);

      expect(() => enforcePolicy('admission_officer', 'admissions:approve_decision')).toThrow(AuthorizationError);
      expect(() => enforcePolicy('admission_officer', 'fees:approve_concession')).toThrow(AuthorizationError);
    });
  });

  describe('Accounts Officer Authority (Ledger Operations)', () => {
    it('permits fee entry, dues viewing, and ledger operations', () => {
      expect(hasPermission('accountant', 'fees:record_payment')).toBe(true);
      expect(hasPermission('accountant', 'fees:configure_structure')).toBe(true);
      expect(hasPermission('accountant', 'fees:view_dues')).toBe(true);
      expect(hasPermission('accountant', 'fees:request_concession')).toBe(true);
      expect(hasPermission('accountant', 'fees:request_reversal')).toBe(true);
    });

    it('strictly forbids access to sensitive student/parent PII (US-03)', () => {
      expect(hasPermission('accountant', 'admissions:view_sensitive_pii')).toBe(false);
      expect(() => enforcePolicy('accountant', 'admissions:view_sensitive_pii')).toThrow(AuthorizationError);
    });

    it('strictly forbids approving financial concessions or reversals (Principal only)', () => {
      expect(hasPermission('accountant', 'fees:approve_concession')).toBe(false);
      expect(hasPermission('accountant', 'fees:approve_reversal')).toBe(false);

      expect(() => enforcePolicy('accountant', 'fees:approve_concession')).toThrow(AuthorizationError);
      expect(() => enforcePolicy('accountant', 'fees:approve_reversal')).toThrow(AuthorizationError);
    });
  });

  describe('System Administrator Authority (Technical Staff Management)', () => {
    it('permits technical staff directory operations and audit log inspection', () => {
      expect(hasPermission('system_admin', 'users:manage_accounts')).toBe(true);
      expect(hasPermission('system_admin', 'audit:view_logs')).toBe(true);
    });

    it('strictly forbids business admissions, financial policy, payments, and certificates', () => {
      expect(hasPermission('system_admin', 'admissions:approve_decision')).toBe(false);
      expect(hasPermission('system_admin', 'admissions:view_sensitive_pii')).toBe(false);
      expect(hasPermission('system_admin', 'fees:approve_concession')).toBe(false);
      expect(hasPermission('system_admin', 'fees:approve_reversal')).toBe(false);
      expect(hasPermission('system_admin', 'fees:record_payment')).toBe(false);
      expect(hasPermission('system_admin', 'certificates:issue_tc')).toBe(false);

      expect(() => enforcePolicy('system_admin', 'admissions:approve_decision')).toThrow(AuthorizationError);
      expect(() => enforcePolicy('system_admin', 'fees:approve_concession')).toThrow(AuthorizationError);
      expect(() => enforcePolicy('system_admin', 'admissions:view_sensitive_pii')).toThrow(AuthorizationError);
    });
  });
});
