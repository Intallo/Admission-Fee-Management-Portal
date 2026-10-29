import { z } from 'zod';
import { StaffRole } from '../modules/identity-access/types';

export const staffRolesTuple: [StaffRole, ...StaffRole[]] = [
  'system_admin',
  'principal',
  'admission_officer',
  'clerk',
  'accountant',
  'read_only',
];

export const loginSchema = z.object({
  email: z.string().email('Invalid email address').max(255),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
});

export const createStaffMemberSchema = z.object({
  fullName: z.string().min(2, 'Name must be at least 2 characters').max(150),
  email: z.string().email('Invalid email address').max(255),
  role: z.enum(staffRolesTuple),
});

export const updateStaffRoleSchema = z.object({
  role: z.enum(staffRolesTuple).optional(),
  isActive: z.boolean().optional(),
});
