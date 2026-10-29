import { StaffRole } from '../modules/identity-access/types';

export const ALL_ROLES: StaffRole[] = [
  'system_admin',
  'principal',
  'admission_officer',
  'clerk',
  'accountant',
  'read_only',
];

export const ROLE_LABELS: Record<StaffRole, string> = {
  system_admin: 'System Administrator',
  principal: 'Principal',
  admission_officer: 'Admission Officer',
  clerk: 'Clerk',
  accountant: 'Accountant',
  read_only: 'Read Only Viewer',
};

export function isValidStaffRole(role: string): role is StaffRole {
  return ALL_ROLES.includes(role as StaffRole);
}
