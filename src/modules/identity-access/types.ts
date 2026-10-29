/**
 * School Admission & Fee Management Portal
 * Module: Identity & Access Management (Module 1)
 */

import { UUID, IsoTimestampString } from '../shared/types';
import { Database } from '../../types/database.types';

export type StaffRole = Database['public']['Enums']['staff_role'];

export interface StaffMemberDTO {
  id: UUID;
  authUserId: UUID | null;
  fullName: string;
  email: string;
  role: StaffRole;
  isActive: boolean;
  createdAt: IsoTimestampString;
  updatedAt: IsoTimestampString;
}

export interface AuthenticatedUserSession {
  staffId: UUID;
  authUserId: UUID;
  email: string;
  fullName: string;
  role: StaffRole;
  isActive: boolean;
  activeAcademicYearId: UUID;
  activeAcademicYearLabel: string;
}

export interface LoginRequestDTO {
  email: string;
  password: string;
}

export interface LoginResponseDTO {
  user: StaffMemberDTO;
  sessionExpirySeconds: number;
}

export interface CreateStaffMemberDTO {
  fullName: string;
  email: string;
  role: StaffRole;
}

export interface UpdateStaffRoleDTO {
  role: StaffRole;
  isActive?: boolean;
}
