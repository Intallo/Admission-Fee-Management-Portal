import { z } from 'zod';

export const requestCertificateSchema = z.object({
  studentAcademicRecordId: z.string().uuid('Invalid student academic record UUID'),
  certificateType: z.enum(['LC', 'TC']).optional().default('TC'),
  reasonForLeaving: z.string().min(3, 'Reason must be at least 3 characters').max(500),
  dateOfLeaving: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD').optional(),
  intendedSchool: z.string().max(200).optional().nullable(),
  conduct: z.string().max(200).optional().nullable(),
  progress: z.string().max(200).optional().nullable(),
  remarks: z.string().max(500).optional().nullable(),
});

export const reviewCertificateSchema = z.object({
  action: z.enum(['forward_for_approval', 'return_to_draft'], {
    errorMap: () => ({ message: 'Action must be forward_for_approval or return_to_draft' }),
  }),
  conduct: z.string().min(2, 'Conduct remarks must be at least 2 characters').max(200),
  progress: z.string().min(2, 'Progress remarks must be at least 2 characters').max(200),
  remarks: z.string().max(500).optional().nullable(),
});

export const issueCertificateSchema = z.object({
  reasonForLeaving: z.string().max(500).optional().nullable(),
  dateOfLeaving: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD').optional().nullable(),
  conduct: z.string().max(200).optional().nullable(),
  progress: z.string().max(200).optional().nullable(),
  remarks: z.string().max(500).optional().nullable(),
  duesOverrideReason: z.string().max(500).optional().nullable(),
});

export const reprintCertificateSchema = z.object({
  reason: z.string().min(3, 'Reprint reason must be at least 3 characters').max(500),
});

export const batchReviewCertificatesSchema = z.object({
  requests: z.array(
    z.object({
      certificateId: z.string().uuid(),
      action: z.enum(['forward_for_approval', 'return_to_draft']),
      conduct: z.string().min(2).max(200),
      progress: z.string().min(2).max(200),
      remarks: z.string().max(500).optional().nullable(),
    })
  ).min(1, 'At least one certificate must be selected'),
});

// Aliases for TC-specific naming
export const requestTcSchema = requestCertificateSchema;
export const issueTcSchema = issueCertificateSchema;
export const reviewTcSchema = reviewCertificateSchema;
export const reprintTcSchema = reprintCertificateSchema;

export const batchIssueCertificatesSchema = z.object({
  requests: z.array(
    z.object({
      certificateId: z.string().uuid(),
      duesOverrideReason: z.string().max(500).optional().nullable(),
      remarks: z.string().max(500).optional().nullable(),
      dateOfLeaving: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
    })
  ).min(1, 'At least one certificate must be selected'),
});
