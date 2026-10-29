import { describe, it, expect } from 'vitest';
import {
  loginSchema,
  createDraftApplicationSchema,
  recordPaymentSchema,
  feeAdjustmentRequestSchema,
  requestTcSchema,
} from '../src/validation';

describe('Zod Validation at System Boundaries', () => {
  describe('Login Validation', () => {
    it('accepts valid credentials', () => {
      const res = loginSchema.safeParse({
        email: 'principal@school.local',
        password: 'ValidPassword123!',
      });
      expect(res.success).toBe(true);
    });

    it('rejects short passwords', () => {
      const res = loginSchema.safeParse({
        email: 'principal@school.local',
        password: 'short',
      });
      expect(res.success).toBe(false);
    });
  });

  describe('Admission Draft Validation', () => {
    it('accepts valid draft application', () => {
      const res = createDraftApplicationSchema.safeParse({
        academicYearId: '11111111-1111-1111-1111-111111111111',
        requestedGradeLevelId: '22222222-2222-2222-2222-222222222222',
        studentFirstName: 'Aarav',
        studentLastName: 'Patil',
        dateOfBirth: '2020-05-15',
        gender: 'male',
        primaryGuardianName: 'Suresh Patil',
        primaryGuardianPhone: '+919876543210',
      });
      expect(res.success).toBe(true);
    });

    it('rejects invalid date format', () => {
      const res = createDraftApplicationSchema.safeParse({
        academicYearId: '11111111-1111-1111-1111-111111111111',
        requestedGradeLevelId: '22222222-2222-2222-2222-222222222222',
        studentFirstName: 'Aarav',
        studentLastName: 'Patil',
        dateOfBirth: '15/05/2020', // Invalid, must be YYYY-MM-DD
        gender: 'male',
        primaryGuardianName: 'Suresh Patil',
        primaryGuardianPhone: '+919876543210',
      });
      expect(res.success).toBe(false);
    });
  });

  describe('Payment Record Validation (Single Category & Exact INR)', () => {
    it('accepts valid offline single-category payment', () => {
      const res = recordPaymentSchema.safeParse({
        studentAcademicRecordId: '33333333-3333-3333-3333-333333333333',
        feeCategory: 'school_fee',
        paymentMode: 'cash',
        paymentDate: '2026-10-29',
        totalAmount: '15000.00',
        payerName: 'Suresh Patil',
        allocations: [
          {
            assessmentLineId: '44444444-4444-4444-4444-444444444444',
            allocatedAmount: '15000.00',
          },
        ],
      });
      expect(res.success).toBe(true);
    });

    it('rejects invalid fee category or payment mode', () => {
      const res = recordPaymentSchema.safeParse({
        studentAcademicRecordId: '33333333-3333-3333-3333-333333333333',
        feeCategory: 'unauthorized_mixed_category',
        paymentMode: 'online_gateway', // Not supported
        paymentDate: '2026-10-29',
        totalAmount: '15000.00',
        payerName: 'Suresh Patil',
        allocations: [
          {
            assessmentLineId: '44444444-4444-4444-4444-444444444444',
            allocatedAmount: '15000.00',
          },
        ],
      });
      expect(res.success).toBe(false);
    });
  });
});
