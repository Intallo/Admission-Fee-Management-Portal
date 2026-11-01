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
import { IFeeConfigurationRepository } from '../../infrastructure/repositories/interfaces';
import { getRepositories } from '../../infrastructure/repositories/registry';

export class FeeConfigurationService {
  private customRepo?: IFeeConfigurationRepository;

  constructor(repo?: IFeeConfigurationRepository) {
    this.customRepo = repo;
  }

  private get repo(): IFeeConfigurationRepository {
    return this.customRepo ?? getRepositories().feeConfiguration;
  }

  resetForTesting(): void {
    this.repo.resetForTesting?.();
  }

  /**
   * Lists fee heads with optional category and active filtering.
   */
  async listFeeHeads(category?: FeeCategory, activeOnly = true): Promise<FeeHeadDTO[]> {
    let list = await this.repo.listFeeHeads();
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
    const list = await this.repo.listFeeHeads();
    const head = list.find((h) => h.id === id);
    if (!head) {
      throw new NotFoundError(`Fee head with ID "${id}" not found.`);
    }
    return head;
  }

  /**
   * Creates a new fee head (Principal only per Phase 8.1 Directive).
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

    const existing = await this.repo.listFeeHeads(actorSession);
    const duplicate = existing.find((h) => h.code.toUpperCase() === cleanCode);
    if (duplicate) {
      throw new ConflictError(`Fee head with code "${cleanCode}" already exists.`);
    }

    const created = await this.repo.createFeeHead(
      {
        id: randomUUID(),
        code: cleanCode,
        name: cleanName,
        category: payload.category,
        isVariable: !!payload.isVariable,
        isActive: true,
      },
      actorSession
    );

    logger.info('New fee head created', {
      feeHeadId: created.id,
      code: created.code,
      category: created.category,
      actorStaffId: actorSession.staffId,
    });

    return created;
  }

  /**
   * Lists fee structures filtered by academic year, grade, and status.
   */
  async listFeeStructures(filters?: {
    academicYearId?: string;
    gradeLevelId?: string;
    status?: FeeStructureState;
  }): Promise<FeeStructureDTO[]> {
    let list = await this.repo.listFeeStructures(filters?.academicYearId);
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
    return this.repo.getFeeStructureById(id);
  }

  /**
   * Finds the currently approved fee structure for a grade level in an academic year.
   */
  async getApprovedFeeStructureForGrade(
    academicYearId: string,
    gradeLevelId: string
  ): Promise<FeeStructureDTO | null> {
    return this.repo.getFeeStructureForGrade(academicYearId, gradeLevelId);
  }

  /**
   * Creates a draft fee structure.
   */
  async createFeeStructure(
    payload: CreateFeeStructureDTO,
    actorSession: AuthenticatedUserSession
  ): Promise<FeeStructureDTO> {
    enforcePolicy(actorSession.role, 'fees:configure_structure');

    // 1. Assert academic year is writable
    await academicYearsService.assertAcademicYearWritable(payload.academicYearId);

    // 2. Validate at least one line provided
    if (!payload.lines || payload.lines.length === 0) {
      throw new ValidationError('A fee structure must contain at least one fee head line.');
    }

    // 3. Duplicate fee head check within payload
    const headIds = payload.lines.map((l) => l.feeHeadId);
    if (new Set(headIds).size !== headIds.length) {
      throw new ValidationError('Duplicate fee heads are not permitted within a single fee structure.');
    }

    // 4. Verify all fee heads exist and compute total
    const heads = await this.repo.listFeeHeads(actorSession);
    let total = '0.00';
    const lines = [];

    for (const line of payload.lines) {
      const head = heads.find((h) => h.id === line.feeHeadId);
      if (!head) {
        throw new NotFoundError(`Fee head with ID "${line.feeHeadId}" does not exist.`);
      }

      if (!head.isVariable && (line.defaultAmount === undefined || line.defaultAmount === null)) {
        throw new ValidationError(`Fixed fee head "${head.name}" must specify a default amount.`);
      }

      const amt = line.defaultAmount !== undefined && line.defaultAmount !== null
        ? formatInr(line.defaultAmount)
        : null;

      if (amt !== null) {
        total = addInr(total, amt);
      }

      lines.push({
        id: randomUUID(),
        feeHeadId: head.id,
        feeHeadCode: head.code,
        feeHeadName: head.name,
        category: head.category,
        amount: amt,
        isVariable: head.isVariable,
        isOptional: line.isOptional ?? false,
      });
    }

    const existingStructures = (await this.repo.listFeeStructures(payload.academicYearId, actorSession))
      .filter((s: any) => s.gradeLevelId === payload.gradeLevelId);
    const nextVersion = existingStructures.length > 0 
      ? Math.max(...existingStructures.map((s: any) => s.version)) + 1 
      : 1;

    const created = await this.repo.createFeeStructure(
      {
        id: randomUUID(),
        academicYearId: payload.academicYearId,
        gradeLevelId: payload.gradeLevelId,
        version: nextVersion,
        status: 'draft',
        totalAmount: total,
        lines,
      },
      actorSession
    );

    logger.info('Fee structure created in draft status', {
      feeStructureId: created.id,
      academicYearId: payload.academicYearId,
      gradeLevelId: payload.gradeLevelId,
      actorStaffId: actorSession.staffId,
    });

    return created;
  }

  /**
   * Approves a fee structure (Principal only per BR-08 / US-19).
   */
  async approveFeeStructure(
    structureId: string,
    actorSession: AuthenticatedUserSession
  ): Promise<FeeStructureDTO> {
    enforcePolicy(actorSession.role, 'fees:approve_structure');

    const struct = await this.getFeeStructureById(structureId);

    if (struct.status === 'approved') {
      throw new BusinessRuleError('Fee structure is already in approved state.');
    }

    // Assert academic year is not closed
    await academicYearsService.assertAcademicYearWritable(struct.academicYearId);

    const approved = await this.repo.approveFeeStructure(structureId, actorSession);

    logger.info('Fee structure approved by Principal', {
      feeStructureId: structureId,
      gradeLevelId: struct.gradeLevelId,
      actorStaffId: actorSession.staffId,
    });

    return approved;
  }

  /**
   * Lists transport distance rates.
   */
  async listTransportRates(academicYearId?: string): Promise<TransportRateDTO[]> {
    return this.repo.listTransportRates(academicYearId);
  }

  /**
   * Creates a transport rate.
   */
  async createTransportRate(
    payload: CreateTransportRateDTO,
    actorSession: AuthenticatedUserSession
  ): Promise<TransportRateDTO> {
    enforcePolicy(actorSession.role, 'fees:configure_structure');

    await academicYearsService.assertAcademicYearWritable(payload.academicYearId);

    const cleanPlace = (payload as any).placeName || (payload as any).routeName || 'Default Route';
    const rate = formatInr(payload.rateAmount || (payload as any).annualRate || '0.00');

    const created = await this.repo.createTransportRate(
      {
        id: randomUUID(),
        academicYearId: payload.academicYearId,
        routeName: cleanPlace,
        distanceKm: (payload as any).distanceKm || 0,
        annualRate: rate,
        isActive: true,
      },
      actorSession
    );

    return created;
  }

  /**
   * Looks up the applicable transport rate.
   */
  async getTransportRate(
    placeName: string,
    mode: TransportMode,
    academicYearId: string
  ): Promise<TransportRateDTO | null> {
    const rates = await this.repo.listTransportRates(academicYearId);
    const found = rates.find(
      (r) =>
        r.academicYearId === academicYearId &&
        r.routeName.toLowerCase() === placeName.toLowerCase() &&
        r.isActive
    );
    return found || null;
  }
}

export const feeConfigurationService = new FeeConfigurationService();
