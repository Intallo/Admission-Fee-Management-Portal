import { IAcademicYearsRepository } from '../interfaces';
import { AuthenticatedUserSession } from '../../../modules/identity-access/types';
import { AcademicYearDTO, AcademicYearState } from '../../../modules/academic-years/types';
import { NotFoundError } from '../../../lib/errors';
import { randomUUID } from 'crypto';

export class InMemoryAcademicYearsRepository implements IAcademicYearsRepository {
  private academicYearsVault: AcademicYearDTO[] = [
    {
      id: '00000000-0000-0000-0000-000000000000',
      label: '2025-2026',
      startDate: '2025-06-01',
      endDate: '2026-05-31',
      status: 'closed',
      notes: 'Prior academic year (closed and immutable).',
      createdAt: '2025-06-01T00:00:00.000Z',
      updatedAt: '2026-05-31T23:59:59.000Z',
    },
    {
      id: '00000000-0000-0000-0000-000000000001',
      label: '2026-2027',
      startDate: '2026-06-01',
      endDate: '2027-05-31',
      status: 'current',
      notes: 'Current active academic year.',
      createdAt: '2026-06-01T00:00:00.000Z',
      updatedAt: '2026-06-01T00:00:00.000Z',
    },
  ];

  private gradeLevelsVault = [
    { id: '20000000-0000-0000-0000-000000000001', code: 'NURSERY', name: 'Nursery', groupName: 'pre_primary', sortOrder: 1 },
    { id: '20000000-0000-0000-0000-000000000002', code: 'LKG', name: 'LKG', groupName: 'pre_primary', sortOrder: 2 },
    { id: '20000000-0000-0000-0000-000000000003', code: 'UKG', name: 'UKG', groupName: 'pre_primary', sortOrder: 3 },
    { id: '20000000-0000-0000-0000-000000000004', code: 'GRADE_1', name: 'Grade 1', groupName: 'primary', sortOrder: 4 },
  ];

  private sectionsVault = [
    { id: '30000000-0000-0000-0000-000000000001', academicYearId: '00000000-0000-0000-0000-000000000001', gradeLevelId: '20000000-0000-0000-0000-000000000004', name: 'A', maxCapacity: 40, isActive: true },
    { id: '30000000-0000-0000-0000-000000000002', academicYearId: '00000000-0000-0000-0000-000000000001', gradeLevelId: '20000000-0000-0000-0000-000000000004', name: 'B', maxCapacity: 40, isActive: true },
  ];

  resetForTesting(): void {
    // Preserve baseline years
  }

  async listAcademicYears(_session?: AuthenticatedUserSession): Promise<AcademicYearDTO[]> {
    return [...this.academicYearsVault];
  }

  async getAcademicYearById(yearId: string, _session?: AuthenticatedUserSession): Promise<AcademicYearDTO> {
    const found = this.academicYearsVault.find((y) => y.id === yearId);
    if (!found) {
      throw new NotFoundError(`Academic year with ID "${yearId}" not found.`);
    }
    return found;
  }

  async createAcademicYear(data: any, _session?: AuthenticatedUserSession): Promise<AcademicYearDTO> {
    const id = data.id || randomUUID();
    const nowIso = new Date().toISOString();
    const year: AcademicYearDTO = {
      id,
      label: data.label,
      startDate: data.startDate,
      endDate: data.endDate,
      status: (data.status || 'draft') as AcademicYearState,
      notes: data.notes || null,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    this.academicYearsVault.unshift(year);
    return year;
  }

  async closeAcademicYear(yearId: string, _session?: AuthenticatedUserSession): Promise<AcademicYearDTO> {
    const found = this.academicYearsVault.find((y) => y.id === yearId);
    if (!found) {
      throw new NotFoundError(`Academic year "${yearId}" not found.`);
    }
    found.status = 'closed';
    found.updatedAt = new Date().toISOString();
    return found;
  }

  async listGradeLevels(_session?: AuthenticatedUserSession): Promise<any[]> {
    return [...this.gradeLevelsVault];
  }

  async listSections(academicYearId?: string, _session?: AuthenticatedUserSession): Promise<any[]> {
    if (academicYearId) {
      return this.sectionsVault.filter((s) => s.academicYearId === academicYearId);
    }
    return [...this.sectionsVault];
  }

  async getSectionById(sectionId: string, _session?: AuthenticatedUserSession): Promise<any> {
    const found = this.sectionsVault.find((s) => s.id === sectionId);
    if (!found) {
      throw new NotFoundError(`Section "${sectionId}" not found.`);
    }
    return found;
  }

  async updateSectionCapacity(sectionId: string, maxCapacity: number, _session?: AuthenticatedUserSession): Promise<any> {
    const found = this.sectionsVault.find((s) => s.id === sectionId);
    if (!found) {
      throw new NotFoundError(`Section "${sectionId}" not found.`);
    }
    found.maxCapacity = maxCapacity;
    return found;
  }
}
