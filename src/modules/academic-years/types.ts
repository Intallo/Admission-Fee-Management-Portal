/**
 * School Admission & Fee Management Portal
 * Module: Academic Years & Settings (Module 2)
 */

import { UUID, IsoTimestampString } from '../shared/types';
import { Database } from '../../types/database.types';

export type AcademicYearState = Database['public']['Enums']['academic_year_state'];
export type GradeGroup = Database['public']['Enums']['grade_group'];

export interface AcademicYearDTO {
  id: UUID;
  label: string; // e.g. "2026-2027"
  startDate: string; // "YYYY-06-01"
  endDate: string;   // "YYYY-05-31"
  status: AcademicYearState;
  notes: string | null;
  createdAt: IsoTimestampString;
  updatedAt: IsoTimestampString;
}

export interface GradeLevelDTO {
  id: UUID;
  code: string;
  name: string;
  groupName: GradeGroup;
  sortOrder: number;
  isActive: boolean;
}

export interface SectionDTO {
  id: UUID;
  academicYearId: UUID;
  gradeLevelId: UUID;
  name: string;
  maxCapacity: number;
  currentEnrolledCount: number;
  isActive: boolean;
}

export interface CreateAcademicYearDTO {
  label: string;
  startDate: string;
  endDate: string;
  notes?: string;
}

export interface CreateSectionDTO {
  academicYearId: UUID;
  gradeLevelId: UUID;
  name: string;
  maxCapacity: number;
}
