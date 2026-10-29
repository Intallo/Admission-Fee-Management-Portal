import { z } from 'zod';

export const createFeeHeadSchema = z.object({
  code: z.string().min(2).max(50),
  name: z.string().min(2).max(100),
  category: z.enum(['school_fee', 'vehicle', 'books']),
  isVariable: z.boolean().optional().default(false),
});

export const feeStructureLineInputSchema = z.object({
  feeHeadId: z.string().uuid('Invalid fee head UUID'),
  defaultAmount: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, 'Default amount must be an exact INR decimal (e.g. "14000.00")'),
  isOptional: z.boolean().optional().default(false),
});

export const createFeeStructureSchema = z.object({
  academicYearId: z.string().uuid('Invalid academic year UUID'),
  gradeLevelId: z.string().uuid('Invalid grade level UUID'),
  lines: z.array(feeStructureLineInputSchema).min(1, 'At least one fee head line is required'),
});

export const createTransportRateSchema = z.object({
  academicYearId: z.string().uuid('Invalid academic year UUID'),
  placeName: z.string().min(2).max(100),
  mode: z.enum(['school_bus', 'private_vehicle']),
  rateAmount: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, 'Rate amount must be an exact INR decimal (e.g. "6000.00")'),
});

export const paymentAllocationLineSchema = z.object({
  assessmentLineId: z.string().min(1, 'Assessment line ID is required'),
  amount: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, 'Allocation amount must be an exact INR decimal')
    .optional(),
  allocatedAmount: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, 'Allocation amount must be an exact INR decimal')
    .optional(),
}).refine((data) => data.amount !== undefined || data.allocatedAmount !== undefined, {
  message: 'Either amount or allocatedAmount must be provided.',
});

export const recordPaymentSchema = z.object({
  studentAcademicRecordId: z.string().uuid('Invalid student academic record UUID'),
  category: z.enum(['school_fee', 'vehicle', 'books']).optional(),
  feeCategory: z.enum(['school_fee', 'vehicle', 'books']).optional(),
  amount: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, 'Payment amount must be an exact INR decimal')
    .optional(),
  totalAmount: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, 'Total amount must be an exact INR decimal')
    .optional(),
  method: z.enum(['cash', 'cheque', 'bank_transfer', 'upi_manual', 'other']).optional(),
  paymentMode: z.enum(['cash', 'cheque', 'bank_transfer', 'upi_manual', 'other', 'dd', 'pos_card']).optional(),
  payerName: z.string().min(1, 'Payer name is required').max(150),
  referenceNumber: z.string().max(100).optional().nullable(),
  remarks: z.string().max(500).optional().nullable(),
  paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Payment date must be YYYY-MM-DD').optional(),
  allocations: z.array(paymentAllocationLineSchema).min(1, 'At least one allocation line is required'),
}).refine((data) => data.category !== undefined || data.feeCategory !== undefined, {
  message: 'Category is required.',
}).refine((data) => data.amount !== undefined || data.totalAmount !== undefined, {
  message: 'Payment amount is required.',
}).refine((data) => data.method !== undefined || data.paymentMode !== undefined, {
  message: 'Payment method is required.',
});

export const feeAdjustmentRequestSchema = z.object({
  studentAcademicRecordId: z.string().uuid('Invalid student academic record UUID').optional(),
  assessmentLineId: z.string().uuid('Invalid assessment line UUID').optional(),
  studentFeeAssessmentLineId: z.string().uuid('Invalid assessment line UUID').optional(),
  adjustmentType: z.enum(['concession', 'additional_charge', 'correction', 'waiver', 'scholarship']),
  amount: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, 'Adjustment amount must be an exact INR decimal'),
  reason: z.string().min(5, 'Reason must be at least 5 characters').max(500),
}).refine((data) => data.assessmentLineId !== undefined || data.studentFeeAssessmentLineId !== undefined, {
  message: 'Assessment line ID is required.',
});

export const approveFeeAdjustmentSchema = z.object({
  approvalNotes: z.string().max(500).optional(),
});

export const paymentReversalSchema = z.object({
  reason: z.string().min(5, 'Reversal reason of at least 5 characters is mandatory.').max(500),
});

export const issueFinalReceiptSchema = z.object({
  studentAcademicRecordId: z.string().uuid('Invalid student academic record UUID'),
});
