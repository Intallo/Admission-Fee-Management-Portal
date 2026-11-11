import { randomUUID } from 'crypto';
import { AcademicYearDTO, AcademicYearState } from './types';
import { AuthenticatedUserSession } from '../identity-access/types';
import { BusinessRuleError, AuthorizationError, NotFoundError, ValidationError } from '../../lib/errors';
import { logger } from '../../lib/logger';
import { IAcademicYearsRepository } from '../../infrastructure/repositories/interfaces';
import { getRepositories } from '../../infrastructure/repositories/registry';

export class AcademicYearsService {
  private customRepo?: IAcademicYearsRepository;

  constructor(repo?: IAcademicYearsRepository) {
    this.customRepo = repo;
  }

  private get repo(): IAcademicYearsRepository {
    return this.customRepo ?? getRepositories().academicYears;
  }

  resetForTesting(): void {
    this.repo.resetForTesting?.();
  }

  /**
   * Retrieves all academic years.
   */
  async listAcademicYears(session?: AuthenticatedUserSession): Promise<AcademicYearDTO[]> {
    return this.repo.listAcademicYears(session);
  }

  /**
   * Retrieves a single academic year by ID.
   */
  async getAcademicYearById(yearId: string, session?: AuthenticatedUserSession): Promise<AcademicYearDTO> {
    return this.repo.getAcademicYearById(yearId, session);
  }

  /**
   * Asserts that the academic year is writable (not closed).
   * Enforces SBR-05 / BR-39: Closed years block any further business mutations.
   */
  async assertAcademicYearWritable(yearId: string, session?: AuthenticatedUserSession): Promise<AcademicYearDTO> {
    const year = await this.getAcademicYearById(yearId, session);

    if (year.status === 'closed') {
      throw new BusinessRuleError(
        `Disallowed mutation: Academic Year "${year.label}" is closed and strictly read-only.`
      );
    }

    return year;
  }

  /**
   * Alias for asserting that the academic year is not closed.
   */
  async assertYearIsNotClosed(yearId: string, session?: AuthenticatedUserSession): Promise<AcademicYearDTO> {
    return this.assertAcademicYearWritable(yearId, session);
  }

  /**
   * Creates a new academic year in 'planning' state.
   * Authorized: Principal or System Administrator.
   */
  async createAcademicYear(
    payload: {
      label: string;
      startDate: string;
      endDate: string;
      notes?: string;
    },
    actorSession: AuthenticatedUserSession
  ): Promise<AcademicYearDTO> {
    if (actorSession.role !== 'principal') {
      throw new AuthorizationError('Only the Principal possesses authority to create academic years.');
    }

    // 1. Date chronological order validation
    if (new Date(payload.startDate) >= new Date(payload.endDate)) {
      throw new ValidationError('Start date must be strictly before end date.');
    }

    const existingYears = await this.listAcademicYears(actorSession);

    // 2. Duplicate label check
    if (existingYears.some((y) => y.label.trim().toLowerCase() === payload.label.trim().toLowerCase())) {
      throw new BusinessRuleError(`Academic year with label "${payload.label}" already exists.`);
    }

    // 3. Overlapping date ranges check (SRS A-07 / ACCEPTANCE_TESTS.md)
    const newStart = new Date(payload.startDate).getTime();
    const newEnd = new Date(payload.endDate).getTime();

    for (const year of existingYears) {
      const existingStart = new Date(year.startDate).getTime();
      const existingEnd = new Date(year.endDate).getTime();

      const overlaps = (newStart <= existingEnd && newEnd >= existingStart);
      if (overlaps) {
        throw new BusinessRuleError(
          `Date range (${payload.startDate} to ${payload.endDate}) overlaps with existing academic year "${year.label}" (${year.startDate} to ${year.endDate}).`
        );
      }
    }

    const created = await this.repo.createAcademicYear(
      {
        label: payload.label.trim(),
        startDate: payload.startDate,
        endDate: payload.endDate,
        status: 'planning',
        notes: payload.notes || null,
      },
      actorSession
    );

    logger.info('New academic year created in planning state', {
      academicYearId: created.id,
      label: created.label,
      actorStaffId: actorSession.staffId,
    });

    return created;
  }

  /**
   * Formally closes an academic year (Principal only).
   */
  async closeAcademicYear(
    yearId: string,
    actorSession: AuthenticatedUserSession
  ): Promise<AcademicYearDTO> {
    if (actorSession.role !== 'principal') {
      throw new AuthorizationError('Only the Principal possesses authority to formally close an academic year.');
    }

    const year = await this.getAcademicYearById(yearId, actorSession);

    if (year.status === 'closed') {
      throw new BusinessRuleError(`Academic Year "${year.label}" is already closed.`);
    }

    const closed = await this.repo.closeAcademicYear(yearId, actorSession);

    logger.info('Academic year formally closed', {
      academicYearId: yearId,
      label: closed.label,
      actorStaffId: actorSession.staffId,
    });

    return closed;
  }

  async listGradeLevels(session?: AuthenticatedUserSession): Promise<any[]> {
    return this.repo.listGradeLevels(session);
  }

  async listSections(academicYearId?: string, session?: AuthenticatedUserSession): Promise<any[]> {
    return this.repo.listSections(academicYearId, session);
  }

  async getSectionById(sectionId: string, session?: AuthenticatedUserSession): Promise<any> {
    return this.repo.getSectionById(sectionId, session);
  }

  async updateSectionCapacity(sectionId: string, maxCapacity: number, session: AuthenticatedUserSession): Promise<any> {
    if (session.role !== 'principal') {
      throw new AuthorizationError('Only the Principal holds authority to update section seat capacity.');
    }
    return this.repo.updateSectionCapacity(sectionId, maxCapacity, session);
  }
}

export const academicYearsService = new AcademicYearsService();
