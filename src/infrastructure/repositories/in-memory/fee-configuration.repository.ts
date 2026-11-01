import { IFeeConfigurationRepository } from '../interfaces';
import { AuthenticatedUserSession } from '../../../modules/identity-access/types';
import {
  FeeCategory,
  FeeHeadDTO,
  FeeStructureDTO,
  TransportRateDTO,
} from '../../../modules/fee-configuration/types';
import { NotFoundError } from '../../../lib/errors';
import { formatInr } from '../../../lib/money/inr';
import { randomUUID } from 'crypto';

const INITIAL_FEE_HEADS: FeeHeadDTO[] = [
  { id: '50000000-0000-0000-0000-000000000001', code: 'ADMISSION_FEE', name: 'Admission Fee', category: 'school_fee', isVariable: true, isActive: true },
  { id: '50000000-0000-0000-0000-000000000002', code: 'TUITION_FEE', name: 'Tuition Fee', category: 'school_fee', isVariable: false, isActive: true },
  { id: '50000000-0000-0000-0000-000000000003', code: 'DEVELOPMENT_FEE', name: 'Development Fee', category: 'school_fee', isVariable: false, isActive: true },
  { id: '50000000-0000-0000-0000-000000000004', code: 'EXAM_FEE', name: 'Examination Fee', category: 'school_fee', isVariable: false, isActive: true },
  { id: '50000000-0000-0000-0000-000000000005', code: 'BOOKS', name: 'Books and Stationery', category: 'books', isVariable: false, isActive: true },
  { id: '50000000-0000-0000-0000-000000000006', code: 'SCHOOL_BUS', name: 'School Bus / Transport Fee', category: 'vehicle', isVariable: true, isActive: true },
];

const INITIAL_TRANSPORT_RATES: TransportRateDTO[] = [
  {
    id: '70000000-0000-0000-0000-000000000001',
    academicYearId: '00000000-0000-0000-0000-000000000001',
    placeName: 'Hebbal',
    mode: 'school_bus',
    rateAmount: formatInr('6000.00'),
    isActive: true,
  },
  {
    id: '70000000-0000-0000-0000-000000000002',
    academicYearId: '00000000-0000-0000-0000-000000000001',
    placeName: 'Yelahanka',
    mode: 'school_bus',
    rateAmount: formatInr('18000.00'),
    isActive: true,
  },
  {
    id: '70000000-0000-0000-0000-000000000003',
    academicYearId: '00000000-0000-0000-0000-000000000001',
    placeName: 'Jayanagar',
    mode: 'school_bus',
    rateAmount: formatInr('20000.00'),
    isActive: true,
  },
];

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
        defaultAmount: formatInr('0.00'),
        isOptional: false,
      },
      {
        id: '60000000-0000-0000-0001-000000000002',
        feeHeadId: '50000000-0000-0000-0000-000000000002',
        feeHeadName: 'Tuition Fee',
        category: 'school_fee',
        defaultAmount: formatInr('14000.00'),
        isOptional: false,
      },
      {
        id: '60000000-0000-0000-0001-000000000003',
        feeHeadId: '50000000-0000-0000-0000-000000000003',
        feeHeadName: 'Development Fee',
        category: 'school_fee',
        defaultAmount: formatInr('2000.00'),
        isOptional: false,
      },
      {
        id: '60000000-0000-0000-0001-000000000004',
        feeHeadId: '50000000-0000-0000-0000-000000000004',
        feeHeadName: 'Examination Fee',
        category: 'school_fee',
        defaultAmount: formatInr('1200.00'),
        isOptional: false,
      },
      {
        id: '60000000-0000-0000-0001-000000000005',
        feeHeadId: '50000000-0000-0000-0000-000000000005',
        feeHeadName: 'Books and Stationery',
        category: 'books',
        defaultAmount: formatInr('2500.00'),
        isOptional: false,
      },
    ],
    totalFixedAmountInr: formatInr('19700.00'),
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
        defaultAmount: formatInr('0.00'),
        isOptional: false,
      },
      {
        id: '60000000-0000-0000-0002-000000000002',
        feeHeadId: '50000000-0000-0000-0000-000000000002',
        feeHeadName: 'Tuition Fee',
        category: 'school_fee',
        defaultAmount: formatInr('8500.00'),
        isOptional: false,
      },
      {
        id: '60000000-0000-0000-0002-000000000003',
        feeHeadId: '50000000-0000-0000-0000-000000000003',
        feeHeadName: 'Development Fee',
        category: 'school_fee',
        defaultAmount: formatInr('2000.00'),
        isOptional: false,
      },
      {
        id: '60000000-0000-0000-0002-000000000004',
        feeHeadId: '50000000-0000-0000-0000-000000000004',
        feeHeadName: 'Examination Fee',
        category: 'school_fee',
        defaultAmount: formatInr('1200.00'),
        isOptional: false,
      },
    ],
    totalFixedAmountInr: formatInr('11700.00'),
  },
];

export class InMemoryFeeConfigurationRepository implements IFeeConfigurationRepository {
  private feeHeadsVault: FeeHeadDTO[] = JSON.parse(JSON.stringify(INITIAL_FEE_HEADS));
  private feeStructuresVault = new Map<string, FeeStructureDTO>();
  private transportRatesVault: TransportRateDTO[] = JSON.parse(JSON.stringify(INITIAL_TRANSPORT_RATES));

  constructor() {
    this.resetForTesting();
  }

  resetForTesting(): void {
    this.feeHeadsVault = JSON.parse(JSON.stringify(INITIAL_FEE_HEADS));
    this.transportRatesVault = JSON.parse(JSON.stringify(INITIAL_TRANSPORT_RATES));
    this.feeStructuresVault.clear();
    for (const fs of INITIAL_FEE_STRUCTURES) {
      this.feeStructuresVault.set(fs.id, JSON.parse(JSON.stringify(fs)));
    }
  }

  async listFeeHeads(_session?: AuthenticatedUserSession): Promise<FeeHeadDTO[]> {
    return [...this.feeHeadsVault];
  }

  async createFeeHead(payload: any, _session?: AuthenticatedUserSession): Promise<FeeHeadDTO> {
    const id = payload.id || randomUUID();
    const head: FeeHeadDTO = {
      id,
      code: payload.code,
      name: payload.name,
      category: payload.category as FeeCategory,
      isVariable: payload.isVariable ?? false,
      isActive: payload.isActive ?? true,
    };
    this.feeHeadsVault.push(head);
    return head;
  }

  async listFeeStructures(academicYearId?: string, _session?: AuthenticatedUserSession): Promise<FeeStructureDTO[]> {
    const all = Array.from(this.feeStructuresVault.values());
    if (academicYearId) {
      return all.filter((s) => s.academicYearId === academicYearId);
    }
    return all;
  }

  async getFeeStructureById(id: string, _session?: AuthenticatedUserSession): Promise<FeeStructureDTO> {
    const found = this.feeStructuresVault.get(id);
    if (!found) {
      throw new NotFoundError(`Fee structure "${id}" not found.`);
    }
    return found;
  }

  async getFeeStructureForGrade(
    academicYearId: string,
    gradeLevelId: string,
    _session?: AuthenticatedUserSession
  ): Promise<FeeStructureDTO | null> {
    for (const struct of this.feeStructuresVault.values()) {
      if (struct.academicYearId === academicYearId && struct.gradeLevelId === gradeLevelId && struct.status === 'approved') {
        return struct;
      }
    }
    return null;
  }

  async createFeeStructure(payload: any, _session?: AuthenticatedUserSession): Promise<FeeStructureDTO> {
    const id = payload.id || randomUUID();
    const existing = Array.from(this.feeStructuresVault.values()).filter(
      (s) => s.academicYearId === payload.academicYearId && s.gradeLevelId === payload.gradeLevelId
    );
    const version = payload.version || (existing.length > 0 ? Math.max(...existing.map((s) => s.version)) + 1 : 1);

    const struct: FeeStructureDTO = {
      id,
      academicYearId: payload.academicYearId,
      gradeLevelId: payload.gradeLevelId,
      gradeLevelName: payload.gradeLevelName || 'Grade 1',
      version,
      status: payload.status || 'draft',
      approvedBy: null,
      approvedAt: null,
      totalFixedAmountInr: formatInr(payload.totalFixedAmountInr || payload.totalAmount || '0.00'),
      lines: payload.lines || [],
    };
    this.feeStructuresVault.set(id, struct);
    return struct;
  }

  async approveFeeStructure(id: string, _session?: AuthenticatedUserSession): Promise<FeeStructureDTO> {
    const found = this.feeStructuresVault.get(id);
    if (!found) {
      throw new NotFoundError(`Fee structure "${id}" not found.`);
    }

    // Retire previously approved structures for this year and grade
    for (const [sid, s] of this.feeStructuresVault.entries()) {
      if (
        s.academicYearId === found.academicYearId &&
        s.gradeLevelId === found.gradeLevelId &&
        s.status === 'approved' &&
        sid !== id
      ) {
        s.status = 'retired';
        this.feeStructuresVault.set(sid, s);
      }
    }

    found.status = 'approved';
    found.approvedBy = _session?.staffId || '11111111-1111-1111-1111-111111111111';
    found.approvedAt = new Date().toISOString();
    this.feeStructuresVault.set(id, found);
    return found;
  }

  async listTransportRates(academicYearId?: string, _session?: AuthenticatedUserSession): Promise<TransportRateDTO[]> {
    if (academicYearId) {
      return this.transportRatesVault.filter((r) => r.academicYearId === academicYearId);
    }
    return [...this.transportRatesVault];
  }

  async createTransportRate(payload: any, _session?: AuthenticatedUserSession): Promise<TransportRateDTO> {
    const id = payload.id || randomUUID();
    const rate: TransportRateDTO = {
      id,
      academicYearId: payload.academicYearId,
      placeName: payload.placeName || payload.routeName || 'Default Route',
      mode: payload.mode || 'school_bus',
      rateAmount: formatInr(payload.rateAmount || payload.annualRate || '0.00'),
      isActive: payload.isActive ?? true,
    };
    this.transportRatesVault.push(rate);
    return rate;
  }
}
