import { z } from 'zod';

export const searchStudentsSchema = z.object({
  search: z.string().max(100).optional(),
  academicYearId: z.string().optional(),
  gradeLevelId: z.string().uuid().optional(),
  sectionId: z.string().uuid().optional(),
  status: z.enum(['admitted', 'active', 'left', 'transferred', 'withdrawn', 'all']).optional(),
  limit: z.coerce.number().min(1).max(100).optional(),
  offset: z.coerce.number().min(0).optional(),
});

export const markStudentStatusSchema = z.object({
  academicRecordId: z.string().uuid('Invalid student academic record UUID'),
  newStatus: z.enum(['left', 'transferred', 'withdrawn'], {
    errorMap: () => ({ message: 'Status must be one of: "left", "transferred", "withdrawn"' }),
  }),
  exitDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Exit date must be in YYYY-MM-DD format'),
  exitReason: z.string().min(3, 'Exit reason must be at least 3 characters').max(500),
});
