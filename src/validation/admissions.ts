import { z } from 'zod';

export const createDraftApplicationSchema = z.object({
  academicYearId: z.string().uuid('Invalid academic year UUID'),
  requestedGradeLevelId: z.string().uuid('Invalid grade level UUID'),
  requestedSectionId: z.string().uuid('Invalid section UUID').optional().nullable(),
  studentFirstName: z.string().min(1, 'First name is required').max(100),
  studentMiddleName: z.string().max(100).optional().nullable(),
  studentLastName: z.string().min(1, 'Last name is required').max(100),
  dateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date of birth must be YYYY-MM-DD')
    .refine((dob) => new Date(dob) <= new Date(), {
      message: 'Date of birth cannot be in the future',
    })
    .optional()
    .nullable(),
  gender: z.enum(['male', 'female', 'other']).optional().nullable(),
  bloodGroup: z.string().max(10).optional().nullable(),
  religion: z.string().max(50).optional().nullable(),
  stsNumber: z.string().max(50).optional().nullable(),
  diseNumber: z.string().max(50).optional().nullable(),
  primaryGuardianName: z.string().min(1, 'Guardian name is required').max(150).optional().nullable(),
  primaryGuardianPhone: z
    .string()
    .regex(/^\+?[0-9]{10,13}$/, 'Valid 10-12 digit phone number required')
    .optional()
    .nullable(),
  primaryGuardianRelationship: z.string().max(50).optional().nullable(),
  residentialAddress: z.string().max(500).optional().nullable(),
  transportMode: z.enum(['School Bus', 'Public', 'Private', 'Walking']).optional().nullable(),
  transportOptedIn: z.boolean().optional().nullable(),
  // Sensitive PII
  aadhaarNumber: z.string().max(20).optional().nullable(),
  caste: z.string().max(100).optional().nullable(),
  subCaste: z.string().max(100).optional().nullable(),
  annualFamilyIncome: z.string().optional().nullable(),
  bankName: z.string().max(100).optional().nullable(),
  accountNumber: z.string().max(50).optional().nullable(),
  ifscCode: z.string().max(20).optional().nullable(),
});

export const submitApplicationSchema = z.object({
  overrideMissingDocumentsReason: z.string().max(500).optional(),
});

export const approveApplicationSchema = z.object({
  assignedSectionId: z.string().uuid('Assigned section UUID is required'),
  remarks: z.string().max(500).optional(),
});

export const rejectApplicationSchema = z.object({
  reason: z.string().min(5, 'Rejection reason of at least 5 characters is required').max(500),
});

export const holdApplicationSchema = z.object({
  reason: z.string().min(3, 'Hold reason is required').max(500),
  seatReservedUntil: z.string().optional().nullable(),
});

export const returnToDraftSchema = z.object({
  reason: z.string().min(3, 'Reason for returning to draft is required').max(500),
});
