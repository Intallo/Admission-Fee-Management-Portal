import { randomUUID } from 'crypto';
import {
  FeeCategory,
  FeeHeadDTO,
  FeeStructureDTO,
  FeeStructureLineDTO,
  FeeStructureState,
  TransportMode,
  TransportRateDTO,
  CreateFeeStructureDTO,
  CreateTransportRateDTO,
} from './types';
import { AuthenticatedUserSession } from '../identity-access/types';
import {
  AuthorizationError,
  BusinessRuleError,
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../../lib/errors';
import { enforcePolicy } from '../../policy/guards';
import { academicYearsService } from '../academic-years/service';
import { logger } from '../../lib/logger';
import { toDecimalInrString } from '../shared/types';
import { addInr, formatInr, toDecimal } from '../../lib/money/inr';
import { getAdminDbClient } from '../../infrastructure/db/supabase-admin';

// Master Fee Heads (default catalog)
const INITIAL_FEE_HEADS: FeeHeadDTO[] = [
  {
    id: '50000000-0000-0000-0000-000000000001',
    code: 'ADMISSION_FEE',
    name: 'Admission Fee',
    category: 'school_fee',
    isVariable: true,
    isActive: true,
  },
  {
    id: '50000000-0000-0000-0000-000000000002',
    code: 'TUITION_FEE',
    name: 'Tuition Fee',
    category: 'school_fee',
    isVariable: false,
    isActive: true,
  },
  {
    id: '50000000-0000-0000-0000-000000000003',
    code: 'DEVELOPMENT_FEE',
    name: 'Development Fee',
    category: 'school_fee',
    isVariable: false,
    isActive: true,
  },
  {
    id: '50000000-0000-0000-0000-000000000004',
    code: 'EXAM_FEE',
    name: 'Examination Fee',
    category: 'school_fee',
    isVariable: false,
    isActive: true,
  },
  {
    id: '50000000-0000-0000-0000-000000000005',
    code: 'BOOKS',
    name: 'Books and Stationery',
    category: 'books',
    isVariable: false,
    isActive: true,
  },
  {
    id: '50000000-0000-0000-0000-000000000006',
    code: 'SCHOOL_BUS',
    name: 'School Bus / Transport Fee',
    category: 'vehicle',
    isVariable: true,
    isActive: true,
  },
];

// Default Transport Rates
const INITIAL_TRANSPORT_RATES: TransportRateDTO[] = [
  {
    id: '70000000-0000-0000-0000-000000000001',
    academicYearId: '00000000-0000-0000-0000-000000000001',
    placeName: 'Hebbal',
    mode: 'school_bus',
    rateAmount: toDecimalInrString('6000.00'),
    isActive: true,
  },
  {
    id: '70000000-0000-0000-0000-000000000002',
    academicYearId: '00000000-0000-0000-0000-000000000001',
    placeName: 'Yelahanka',
    mode: 'school_bus',
    rateAmount: toDecimalInrString('8000.00'),
    isActive: true,
  },
  {
    id: '70000000-0000-0000-0000-000000000003',
    academicYearId: '00000000-0000-0000-0000-000000000001',
    placeName: 'Jayanagar',
    mode: 'school_bus',
    rateAmount: toDecimalInrString('10000.00'),
    isActive: true,
  },
];

// Default Fee Structures
const INITIAL_FEE_STRUCTURES: FeeStructureDTO[] = [
  {
    id: '60000000-0000-0000-0000-000000000001',
    academicYearId: '00000000-0000-0000-0000-000000000001',
    gradeLevelId: '30000000-0000-0000-0000-000000000004', // STD1
    gradeLevelName: 'Class 1',
    version: 1,
    status: 'approved',
    approvedBy: '11111111-1111-1111-1111-111111111111',
    approvedAt: '2026-06-01T08:00:00.000Z',
    lines: [
      {
        id: '60000000-0000-0000-0001-000000000001',
        feeHeadId: '50000000-0000-0000-0000-000000000001',
        feeHeadName: 'Admission Fee',
        category: 'school_fee',
        defaultAmount: toDecimalInrString('0.00'),
        isOptional: false,
      },
      {
        id: '60000000-0000-0000-0001-000000000002',
        feeHeadId: '50000000-0000-0000-0000-000000000002',
        feeHeadName: 'Tuition Fee',
        category: 'school_fee',
        defaultAmount: toDecimalInrString('14000.00'),
        isOptional: false,
      },
      {
        id: '60000000-0000-0000-0001-000000000003',
        feeHeadId: '50000000-0000-0000-0000-000000000003',
        feeHeadName: 'Development Fee',
        category: 'school_fee',
        defaultAmount: toDecimalInrString('2000.00'),
        isOptional: false,
      },
      {
        id: '60000000-0000-0000-0001-000000000004',
        feeHeadId: '50000000-0000-0000-0000-000000000004',
        feeHeadName: 'Examination Fee',
        category: 'school_fee',
        defaultAmount: toDecimalInrString('1200.00'),
        isOptional: false,
      },
      {
        id: '60000000-0000-0000-0001-000000000005',
        feeHeadId: '50000000-0000-0000-0000-000000000005',
        feeHeadName: 'Books and Stationery',
        category: 'books',
        defaultAmount: toDecimalInrString('2500.00'),
        isOptional: false,
      },
    ],
    totalFixedAmountInr: toDecimalInrString('19700.00'),
  },
  {
    id: '60000000-0000-0000-0000-000000000002',
    academicYearId: '00000000-0000-0000-0000-000000000001',
    gradeLevelId: '30000000-0000-0000-0000-000000000001', // Nursery
    gradeLevelName: 'Nursery',
    version: 1,
    status: 'approved',
    approvedBy: '11111111-1111-1111-1111-111111111111',
    approvedAt: '2026-06-01T08:00:00.000Z',
    lines: [
      {
        id: '60000000-0000-0000-0002-000000000001',
        feeHeadId: '50000000-0000-0000-0000-000000000001',
        feeHeadName: 'Admission Fee',
        category: 'school_fee',
        defaultAmount: toDecimalInrString('0.00'),
        isOptional: false,
      },
      {
        id: '60000000-0000-0000-0002-000000000002',
        feeHeadId: '50000000-0000-0000-0000-000000000002',
        feeHeadName: 'Tuition Fee',
        category: 'school_fee',
        defaultAmount: toDecimalInrString('10000.00'),
        isOptional: false,
      },
      {
        id: '60000000-0000-0000-0002-000000000003',
        feeHeadId: '50000000-0000-0000-0000-000000000003',
        feeHeadName: 'Development Fee',
        category: 'school_fee',
        defaultAmount: toDecimalInrString('1500.00'),
        isOptional: false,
      },
    ],
    totalFixedAmountInr: toDecimalInrString('11500.00'),
  },
];

// In-memory vaults for synthetic execution and test isolation
let feeHeadsVault = new Map<string, FeeHeadDTO>(INITIAL_FEE_HEADS.map((h) => [h.id, { ...h }]));
let transportRatesVault = new Map<string, TransportRateDTO>(INITIAL_TRANSPORT_RATES.map((r) => [r.id, { ...r }]));
let feeStructuresVault = new Map<string, FeeStructureDTO>(INITIAL_FEE_STRUCTURES.map((s) => [s.id, { ...s, lines: s.lines.map((l) => ({ ...l })) }]));

export class FeeConfigurationService {
  /**
   * Resets configuration data for testing.
   */
  resetForTesting(): void {
    feeHeadsVault = new Map<string, FeeHeadDTO>(INITIAL_FEE_HEADS.map((h) => [h.id, { ...h }]));
    transportRatesVault = new Map<string, TransportRateDTO>(INITIAL_TRANSPORT_RATES.map((r) => [r.id, { ...r }]));
    feeStructuresVault = new Map<string, FeeStructureDTO>(INITIAL_FEE_STRUCTURES.map((s) => [s.id, { ...s, lines: s.lines.map((l) => ({ ...l })) }]));
  }

  /**
   * Lists fee heads with optional category and active filtering.
   */
  async listFeeHeads(category?: FeeCategory, activeOnly = true): Promise<FeeHeadDTO[]> {
    let list = Array.from(feeHeadsVault.values());
    if (category) {
      list = list.filter((h) => h.category === category);
    }
    if (activeOnly) {
      list = list.filter((h) => h.isActive);
    }
    return list;
  }

  /**
   * Retrieves a single fee head by ID.
   */
  async getFeeHeadById(id: string): Promise<FeeHeadDTO> {
    const head = feeHeadsVault.get(id);
    if (!head) {
      throw new NotFoundError(`Fee head with ID "${id}" not found.`);
    }
    return head;
  }

  /**
   * Creates a new fee head (Accounts Officer or Principal).
   */
  async createFeeHead(
    payload: {
      code: string;
      name: string;
      category: FeeCategory;
      isVariable?: boolean;
    },
    actorSession: AuthenticatedUserSession
  ): Promise<FeeHeadDTO> {
    enforcePolicy(actorSession.role, 'fees:configure_structure');

    const cleanCode = payload.code.trim().toUpperCase();
    const cleanName = payload.name.trim();

    if (!cleanCode || !cleanName) {
      throw new ValidationError('Fee head code and name are required.');
    }

    const duplicate = Array.from(feeHeadsVault.values()).find(
      (h) => h.code.toUpperCase() === cleanCode
    );
    if (duplicate) {
      throw new ConflictError(`Fee head with code "${cleanCode}" already exists.`);
    }

    const newHead: FeeHeadDTO = {
      id: randomUUID(),
      code: cleanCode,
      name: cleanName,
      category: payload.category,
      isVariable: !!payload.isVariable,
      isActive: true,
    };

    feeHeadsVault.set(newHead.id, newHead);

    logger.info('New fee head created', {
      feeHeadId: newHead.id,
      code: newHead.code,
      category: newHead.category,
      actorStaffId: actorSession.staffId,
    });

    return newHead;
  }

  /**
   * Lists fee structures filtered by academic year, grade, and status.
   */
  async listFeeStructures(filters?: {
    academicYearId?: string;
    gradeLevelId?: string;
    status?: FeeStructureState;
  }): Promise<FeeStructureDTO[]> {
    let list = Array.from(feeStructuresVault.values());
    if (filters?.academicYearId) {
      list = list.filter((s) => s.academicYearId === filters.academicYearId);
    }
    if (filters?.gradeLevelId) {
      list = list.filter((s) => s.gradeLevelId === filters.gradeLevelId);
    }
    if (filters?.status) {
      list = list.filter((s) => s.status === filters.status);
    }
    return list;
  }

  /**
   * Retrieves a single fee structure by ID.
   */
  async getFeeStructureById(id: string): Promise<FeeStructureDTO> {
    const struct = feeStructuresVault.get(id);
    if (!struct) {
      throw new NotFoundError(`Fee structure with ID "${id}" not found.`);
    }
    return struct;
  }

  /**
   * Finds the currently approved fee structure for a grade level in an academic year.
   */
  async getApprovedFeeStructureForGrade(
    academicYearId: string,
    gradeLevelId: string
  ): Promise<FeeStructureDTO | null> {
    const match = Array.from(feeStructuresVault.values()).find(
      (s) =>
        s.academicYearId === academicYearId &&
        s.gradeLevelId === gradeLevelId &&
        s.status === 'approved'
    );
    return match || null;
  }

  /**
   * Creates a draft fee structure (Accounts Officer or Principal).
   */
  async createFeeStructure(
    payload: CreateFeeStructureDTO,
    actorSession: AuthenticatedUserSession
  ): Promise<FeeStructureDTO> {
    enforcePolicy(actorSession.role, 'fees:configure_structure');

    // 1. Assert academic year is writable
    await academicYearsService.assertAcademicYearWritable(payload.academicYearId);

    if (!payload.lines || payload.lines.length === 0) {
      throw new ValidationError('At least one fee head line is required for a fee structure.');
    }

    // 2. Compute next version number for this grade and academic year
    const existing = Array.from(feeStructuresVault.values()).filter(
      (s) => s.academicYearId === payload.academicYearId && s.gradeLevelId === payload.gradeLevelId
    );
    const nextVersion = existing.length > 0 ? Math.max(...existing.map((s) => s.version)) + 1 : 1;

    // 3. Validate lines and calculate total fixed amount
    const structureId = randomUUID();
    let totalFixed = '0.00';
    const lines: FeeStructureLineDTO[] = [];

    const headIdSet = new Set<string>();

    for (const item of payload.lines) {
      if (headIdSet.has(item.feeHeadId)) {
        throw new ValidationError(`Duplicate fee head in structure lines: ${item.feeHeadId}`);
      }
      headIdSet.add(item.feeHeadId);

      const feeHead = await this.getFeeHeadById(item.feeHeadId);
      const rawAmt = item.defaultAmount || (item as any).amount || '0.00';
      const decAmount = toDecimal(rawAmt);

      if (decAmount.isNegative()) {
        throw new ValidationError(`Fee amount for ${feeHead.name} cannot be negative.`);
      }

      const formatted = formatInr(decAmount);
      if (!feeHead.isVariable) {
        totalFixed = addInr(totalFixed, formatted);
      }

      lines.push({
        id: randomUUID(),
        feeHeadId: feeHead.id,
        feeHeadName: feeHead.name,
        category: feeHead.category,
        defaultAmount: feeHead.isVariable ? toDecimalInrString('0.00') : formatted,
        isOptional: !!item.isOptional,
      });
    }

    const newStructure: FeeStructureDTO = {
      id: structureId,
      academicYearId: payload.academicYearId,
      gradeLevelId: payload.gradeLevelId,
      gradeLevelName: 'Grade Level', // Filled in detail
      version: nextVersion,
      status: 'draft',
      approvedBy: null,
      approvedAt: null,
      lines,
      totalFixedAmountInr: toDecimalInrString(totalFixed),
    };

    feeStructuresVault.set(structureId, newStructure);

    logger.info('Fee structure draft created', {
      feeStructureId: structureId,
      academicYearId: payload.academicYearId,
      gradeLevelId: payload.gradeLevelId,
      version: nextVersion,
      actorStaffId: actorSession.staffId,
    });

    return newStructure;
  }

  /**
   * Approves a fee structure (Principal strictly).
   * Freezes the structure and retires any previous approved version.
   */
  async approveFeeStructure(
    structureId: string,
    actorSession: AuthenticatedUserSession
  ): Promise<FeeStructureDTO> {
    enforcePolicy(actorSession.role, 'fees:approve_structure');

    const struct = feeStructuresVault.get(structureId);
    if (!struct) {
      throw new NotFoundError(`Fee structure with ID "${structureId}" not found.`);
    }

    // 1. Assert academic year writable
    await academicYearsService.assertAcademicYearWritable(struct.academicYearId);

    if (struct.status === 'approved') {
      return struct; // Idempotent
    }

    if (struct.status === 'retired') {
      throw new BusinessRuleError('Cannot approve a retired fee structure.');
    }

    // 2. Retire any previously approved fee structure for the same year and grade
    for (const [id, s] of feeStructuresVault.entries()) {
      if (
        s.academicYearId === struct.academicYearId &&
        s.gradeLevelId === struct.gradeLevelId &&
        s.status === 'approved' &&
        id !== structureId
      ) {
        s.status = 'retired';
        feeStructuresVault.set(id, s);
        logger.info('Prior fee structure retired upon new approval', {
          retiredStructureId: id,
          gradeLevelId: s.gradeLevelId,
        });
      }
    }

    const nowIso = new Date().toISOString();
    struct.status = 'approved';
    struct.approvedBy = actorSession.staffId;
    struct.approvedAt = nowIso;
    feeStructuresVault.set(structureId, struct);

    logger.info('Fee structure formally approved by Principal', {
      feeStructureId: structureId,
      academicYearId: struct.academicYearId,
      gradeLevelId: struct.gradeLevelId,
      version: struct.version,
      actorStaffId: actorSession.staffId,
    });

    return struct;
  }

  /**
   * Lists transport rates.
   */
  async listTransportRates(academicYearId?: string): Promise<TransportRateDTO[]> {
    let list = Array.from(transportRatesVault.values());
    if (academicYearId) {
      list = list.filter((r) => r.academicYearId === academicYearId);
    }
    return list;
  }

  /**
   * Creates a transport rate (Accounts Officer or Principal).
   */
  async createTransportRate(
    payload: CreateTransportRateDTO,
    actorSession: AuthenticatedUserSession
  ): Promise<TransportRateDTO> {
    enforcePolicy(actorSession.role, 'fees:configure_structure');

    await academicYearsService.assertAcademicYearWritable(payload.academicYearId);

    const place = payload.placeName.trim();
    if (!place) {
      throw new ValidationError('Place name is required.');
    }

    const rate = formatInr(payload.rateAmount);

    const newRate: TransportRateDTO = {
      id: randomUUID(),
      academicYearId: payload.academicYearId,
      placeName: place,
      mode: payload.mode,
      rateAmount: rate,
      isActive: true,
    };

    transportRatesVault.set(newRate.id, newRate);

    logger.info('Transport rate created', {
      transportRateId: newRate.id,
      placeName: newRate.placeName,
      rateAmount: newRate.rateAmount,
      actorStaffId: actorSession.staffId,
    });

    return newRate;
  }
}

export const feeConfigurationService = new FeeConfigurationService();
