/**
 * School Admission & Fee Management Portal
 * Module: Fee Configuration (Module 4)
 */

import { UUID, DecimalInrString, IsoTimestampString } from '../shared/types';
import { Database } from '../../types/database.types';

export type FeeCategory = Database['public']['Enums']['fee_category']; // 'school_fee' | 'vehicle' | 'books'
export type FeeStructureState = Database['public']['Enums']['fee_structure_state'];
export type TransportMode = Database['public']['Enums']['transport_mode'];

export interface FeeHeadDTO {
  id: UUID;
  code: string;
  name: string;
  category: FeeCategory;
  isVariable: boolean;
  isActive: boolean;
}

export interface FeeStructureLineDTO {
  id: UUID;
  feeHeadId: UUID;
  feeHeadName: string;
  category: FeeCategory;
  defaultAmount: DecimalInrString;
  isOptional: boolean;
}

export interface FeeStructureDTO {
  id: UUID;
  academicYearId: UUID;
  gradeLevelId: UUID;
  gradeLevelName: string;
  version: number;
  status: FeeStructureState;
  approvedBy: UUID | null;
  approvedAt: IsoTimestampString | null;
  lines: FeeStructureLineDTO[];
  totalFixedAmountInr: DecimalInrString;
}

export interface TransportRateDTO {
  id: UUID;
  academicYearId: UUID;
  placeName: string;
  mode: TransportMode;
  rateAmount: DecimalInrString;
  isActive: boolean;
}

export interface CreateFeeStructureDTO {
  academicYearId: UUID;
  gradeLevelId: UUID;
  lines: Array<{
    feeHeadId: UUID;
    defaultAmount: DecimalInrString;
    isOptional?: boolean;
  }>;
}

export interface CreateTransportRateDTO {
  academicYearId: UUID;
  placeName: string;
  mode: TransportMode;
  rateAmount: DecimalInrString;
}
