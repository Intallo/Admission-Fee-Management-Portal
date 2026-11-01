import { IAdmissionsRepository } from '../interfaces';
import { AuthenticatedUserSession } from '../../../modules/identity-access/types';
import { admissionsService } from '../../../modules/admissions/service';

export class InMemoryAdmissionsRepository implements IAdmissionsRepository {
  resetForTesting(): void {
    admissionsService.resetForTesting();
  }

  async getNextApplicationNumber(academicYearId: string, yearLabel: string, _session?: AuthenticatedUserSession): Promise<string> {
    return admissionsService.getNextApplicationNumber(academicYearId, yearLabel);
  }

  async getNextAdmissionNumber(academicYearId: string, yearLabel: string, _session?: AuthenticatedUserSession): Promise<string> {
    return admissionsService.getNextAdmissionNumber(academicYearId, yearLabel);
  }

  async createDraft(payload: any, session?: AuthenticatedUserSession): Promise<any> {
    return admissionsService.createDraftApplication(payload, session as any);
  }

  async updateDraft(applicationId: string, payload: any, session?: AuthenticatedUserSession): Promise<any> {
    return admissionsService.updateDraftApplication(applicationId, payload, session as any);
  }

  async getApplicationById(applicationId: string, session?: AuthenticatedUserSession): Promise<any> {
    return admissionsService.getApplicationById(applicationId, session as any);
  }

  async listApplications(filter: any, session?: AuthenticatedUserSession): Promise<any> {
    return admissionsService.listApplications(filter, session as any);
  }

  async checkCapacity(sectionId: string, academicYearId: string, _session?: AuthenticatedUserSession): Promise<any> {
    return admissionsService.checkCapacity(sectionId, academicYearId);
  }

  async approveApplication(
    applicationId: string,
    payload: any,
    session?: AuthenticatedUserSession
  ): Promise<any> {
    return admissionsService.approveApplication(applicationId, payload, session as any);
  }

  async getAcademicRecordById(recordId: string, _session?: AuthenticatedUserSession): Promise<any> {
    return admissionsService.getAcademicRecord(recordId);
  }

  async listAcademicRecordsForYear(academicYearId: string, _session?: AuthenticatedUserSession): Promise<any[]> {
    return admissionsService.getAllAcademicRecords().filter((r) => r.academicYearId === academicYearId);
  }
}
