import { IStudentRecordsRepository } from '../interfaces';
import { AuthenticatedUserSession } from '../../../modules/identity-access/types';
import {
  StudentProfileDTO,
  StudentSearchFilterDTO,
  StudentSearchItemDTO,
} from '../../../modules/student-records/types';
import { NotFoundError } from '../../../lib/errors';

export class InMemoryStudentRecordsRepository implements IStudentRecordsRepository {
  private recordsVault = new Map<string, any>();
  private statusHistoryVault = new Map<string, any[]>();

  resetForTesting(): void {
    this.recordsVault.clear();
    this.statusHistoryVault.clear();
  }

  async searchStudents(
    filter: StudentSearchFilterDTO,
    _session: AuthenticatedUserSession
  ): Promise<{ data: StudentSearchItemDTO[]; total: number }> {
    const all = Array.from(this.recordsVault.values());
    let filtered = all;

    if (filter.academicYearId && filter.academicYearId !== 'all') {
      filtered = filtered.filter((r) => r.academicYearId === filter.academicYearId);
    }
    if (filter.gradeLevelId) {
      filtered = filtered.filter((r) => r.gradeLevelId === filter.gradeLevelId);
    }
    if (filter.sectionId) {
      filtered = filtered.filter((r) => r.sectionId === filter.sectionId);
    }
    if (filter.status && filter.status !== 'all') {
      filtered = filtered.filter((r) => r.status === filter.status);
    }
    if (filter.search) {
      const q = filter.search.toLowerCase().trim();
      filtered = filtered.filter(
        (r) =>
          r.fullName?.toLowerCase().includes(q) ||
          r.admissionNumber?.toLowerCase().includes(q) ||
          r.stsNumber?.toLowerCase().includes(q)
      );
    }

    const limit = filter.limit || 20;
    const offset = filter.offset || 0;

    return {
      data: filtered.slice(offset, offset + limit),
      total: filtered.length,
    };
  }

  async getStudentProfile(recordId: string, _session: AuthenticatedUserSession): Promise<StudentProfileDTO> {
    const found = this.recordsVault.get(recordId);
    if (!found) {
      throw new NotFoundError(`Student record "${recordId}" not found.`);
    }
    return found;
  }

  async updateStudentStatus(
    recordId: string,
    status: any,
    reason: string,
    _session: AuthenticatedUserSession
  ): Promise<any> {
    const found = this.recordsVault.get(recordId);
    if (!found) {
      throw new NotFoundError(`Student record "${recordId}" not found.`);
    }
    found.status = status;
    const history = this.statusHistoryVault.get(recordId) || [];
    history.push({
      status,
      reason,
      changedAt: new Date().toISOString(),
    });
    this.statusHistoryVault.set(recordId, history);
    return found;
  }

  async getStatusHistory(recordId: string, _session?: AuthenticatedUserSession): Promise<any[]> {
    return this.statusHistoryVault.get(recordId) || [];
  }
}
