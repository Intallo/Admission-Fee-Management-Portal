import { describe, it, expect } from 'vitest';
import { hasPermission, assertPermission } from '../src/policy/permissions';

describe('Role-Based Policy Enforcement (AUTHORIZATION_MATRIX.md)', () => {
  describe('Principal Permissions', () => {
    it('grants admission approval and seat limits', () => {
      expect(hasPermission('principal', 'admissions:approve_decision')).toBe(true);
      expect(hasPermission('principal', 'admissions:set_seat_limits')).toBe(true);
      expect(hasPermission('principal', 'admissions:view_sensitive_pii')).toBe(true);
    });

    it('grants financial concessions and reversals approval', () => {
      expect(hasPermission('principal', 'fees:approve_concession')).toBe(true);
      expect(hasPermission('principal', 'fees:approve_reversal')).toBe(true);
    });

    it('grants TC issue authority', () => {
      expect(hasPermission('principal', 'certificates:issue_tc')).toBe(true);
    });

    it('denies verification submission (belongs to admission officer)', () => {
      expect(hasPermission('principal', 'admissions:submit_verification')).toBe(false);
    });
  });

  describe('Accountant Permissions', () => {
    it('grants fee recording and structure entry', () => {
      expect(hasPermission('accountant', 'fees:record_payment')).toBe(true);
      expect(hasPermission('accountant', 'fees:configure_structure')).toBe(true);
      expect(hasPermission('accountant', 'fees:view_dues')).toBe(true);
    });

    it('denies financial concession or reversal approval (Principal only)', () => {
      expect(hasPermission('accountant', 'fees:approve_concession')).toBe(false);
      expect(hasPermission('accountant', 'fees:approve_reversal')).toBe(false);
    });

    it('denies sensitive demographic PII access', () => {
      expect(hasPermission('accountant', 'admissions:view_sensitive_pii')).toBe(false);
    });
  });

  describe('Admission Officer Permissions', () => {
    it('grants draft creation and verification submission', () => {
      expect(hasPermission('admission_officer', 'admissions:create_draft')).toBe(true);
      expect(hasPermission('admission_officer', 'admissions:submit_verification')).toBe(true);
      expect(hasPermission('admission_officer', 'admissions:view_sensitive_pii')).toBe(true);
    });

    it('denies admission decision approval (Principal only)', () => {
      expect(hasPermission('admission_officer', 'admissions:approve_decision')).toBe(false);
    });

    it('grants TC review (step 1) but denies TC issue (step 2)', () => {
      expect(hasPermission('admission_officer', 'certificates:review_tc')).toBe(true);
      expect(hasPermission('admission_officer', 'certificates:issue_tc')).toBe(false);
    });
  });

  describe('System Administrator Permissions', () => {
    it('grants user account management and audit views', () => {
      expect(hasPermission('system_admin', 'users:manage_accounts')).toBe(true);
      expect(hasPermission('system_admin', 'audit:view_logs')).toBe(true);
    });

    it('denies access to sensitive PII and business decisions', () => {
      expect(hasPermission('system_admin', 'admissions:view_sensitive_pii')).toBe(false);
      expect(hasPermission('system_admin', 'admissions:approve_decision')).toBe(false);
      expect(hasPermission('system_admin', 'fees:approve_concession')).toBe(false);
      expect(hasPermission('system_admin', 'fees:record_payment')).toBe(false);
    });
  });

  describe('Permission Assertion Guard', () => {
    it('throws error when role lacks permission', () => {
      expect(() => {
        assertPermission('accountant', 'admissions:approve_decision');
      }).toThrow(/Access Denied/);
    });
  });
});
