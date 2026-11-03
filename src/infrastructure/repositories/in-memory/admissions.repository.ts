import { IAdmissionsRepository } from '../interfaces';
import { AuthenticatedUserSession } from '../../../modules/identity-access/types';
import {
  AdmissionApplicationStatus,
  SectionCapacityDTO,
} from '../../../modules/admissions/types';
import {
  AuthorizationError,
  BusinessRuleError,
  NotFoundError,
} from '../../../lib/errors';
import { randomUUID } from 'crypto';
import { formatInr } from '../../../lib/money/inr';

export class InMemoryAdmissionsRepository implements IAdmissionsRepository {
  private applicationsVault = new Map<string, any>();
  private studentsVault = new Map<string, any>();
  private academicRecordsVault = new Map<string, any>();
  private feeAssessmentsVault = new Map<string, any>();
  private statusHistoryVault = new Map<string, any[]>();
  private appSeq = 1;
  private admSeq = 1;

  resetForTesting(): void {
    this.applicationsVault.clear();
    this.studentsVault.clear();
    this.academicRecordsVault.clear();
    this.feeAssessmentsVault.clear();
    this.statusHistoryVault.clear();
    this.appSeq = 1;
    this.admSeq = 1; (this as any)._appSeqsByYear?.clear(); (this as any)._admSeqsByYear?.clear();
  }

  async getNextApplicationNumber(academicYearId: string, yearLabel: string, _session?: AuthenticatedUserSession): Promise<string> {
    const seq = this.appSeq++;
    if (!(this as any)._appSeqsByYear) (this as any)._appSeqsByYear = new Map<string, number>();
    const key = academicYearId || 'default';
    const current = (this as any)._appSeqsByYear.get(key) || 1;
    (this as any)._appSeqsByYear.set(key, current + 1);
    this.appSeq = current + 1;
    const shortLabel = yearLabel ? (yearLabel.match(/^(\d{4})-(\d{4})$/) ? `${yearLabel.slice(0, 4)}-${yearLabel.slice(-2)}` : yearLabel) : '2026-27';
    return `${current}/${shortLabel}`;
  }

  async getNextAdmissionNumber(academicYearId: string, yearLabel: string, _session?: AuthenticatedUserSession): Promise<string> {
    const seq = String(this.admSeq++).padStart(4, '0');
    if (!(this as any)._admSeqsByYear) (this as any)._admSeqsByYear = new Map<string, number>();
    const key = academicYearId || 'default';
    const current = (this as any)._admSeqsByYear.get(key) || 1;
    (this as any)._admSeqsByYear.set(key, current + 1);
    this.admSeq = current + 1;
    const startYearMatch = yearLabel ? yearLabel.match(/^(\d{4})/) : null;
    const startYear = startYearMatch ? startYearMatch[1] : '2026';
    const padded = String(current).padStart(4, '0');
    return `ADM-${startYear}-${padded}`;
  }

  async createDraft(payload: any, session?: AuthenticatedUserSession): Promise<any> {
    const applicationId = payload.id || randomUUID();
    const studentId = payload.studentId || payload.student?.id || randomUUID();
    const applicationNumber = payload.applicationNumber || await this.getNextApplicationNumber(payload.academicYearId, '2026-2027');
    const nowIso = new Date().toISOString();

    const student = {
      id: studentId,
      ...payload.student,
    };
    this.studentsVault.set(studentId, student);

    const app = {
      id: applicationId,
      applicationNumber,
      academicYearId: payload.academicYearId,
      requestedGradeLevelId: payload.gradeLevelId,
      requestedSectionId: payload.sectionId || null,
      status: 'draft',
      studentId,
      student,
      guardians: payload.guardians || [],
      statusHistory: [
        {
          id: randomUUID(),
          fromStatus: null,
          toStatus: 'draft',
          changedBy: session ? session.staffId : 'system',
          changedByName: session ? session.fullName : 'System',
          reason: 'Application draft created.',
          changedAt: nowIso,
        },
      ],
      feeGenerated: false,
    };
    this.applicationsVault.set(applicationId, app);
    return app;
  }

  async updateDraft(applicationId: string, payload: any, _session?: AuthenticatedUserSession): Promise<any> {
    const app = this.applicationsVault.get(applicationId);
    if (!app) {
      throw new NotFoundError(`Admission application "${applicationId}" not found.`);
    }
    if (payload.student) {
      app.student = { ...app.student, ...payload.student };
      this.studentsVault.set(app.studentId, app.student);
    }
    if (payload.gradeLevelId) app.requestedGradeLevelId = payload.gradeLevelId;
    if (payload.sectionId) app.requestedSectionId = payload.sectionId;
    return app;
  }

  async submitApplication(applicationId: string, session?: AuthenticatedUserSession): Promise<any> {
    const app = this.applicationsVault.get(applicationId);
    if (!app) throw new NotFoundError(`Application "${applicationId}" not found.`);
    app.status = 'submitted';
    app.statusHistory.push({
      id: randomUUID(),
      fromStatus: 'draft',
      toStatus: 'submitted',
      changedBy: session ? session.staffId : 'system',
      changedByName: session ? session.fullName : 'System',
      reason: 'Application submitted.',
      changedAt: new Date().toISOString(),
    });
    return app;
  }

  async reviewApplication(applicationId: string, payload: any, session?: AuthenticatedUserSession): Promise<any> {
    const app = this.applicationsVault.get(applicationId);
    if (!app) throw new NotFoundError(`Application "${applicationId}" not found.`);
    const toStatus = payload.action === 'approve_review' ? 'under_review' : 'on_hold';
    app.status = toStatus;
    app.statusHistory.push({
      id: randomUUID(),
      fromStatus: 'submitted',
      toStatus,
      changedBy: session ? session.staffId : 'system',
      changedByName: session ? session.fullName : 'System',
      reason: payload.remarks || 'Reviewed application.',
      changedAt: new Date().toISOString(),
    });
    return app;
  }

  async rejectApplication(applicationId: string, payload: any, session?: AuthenticatedUserSession): Promise<any> {
    if (session && session.role !== 'principal') {
      throw new AuthorizationError('Only Principal can reject an admission application.');
    }
    const app = this.applicationsVault.get(applicationId);
    if (!app) throw new NotFoundError(`Application "${applicationId}" not found.`);
    app.status = 'rejected';
    app.decisionReason = payload.decisionReason || 'Rejected by Principal.';
    app.statusHistory.push({
      id: randomUUID(),
      fromStatus: 'under_review',
      toStatus: 'rejected',
      changedBy: session ? session.staffId : 'system',
      changedByName: session ? session.fullName : 'System',
      reason: app.decisionReason,
      changedAt: new Date().toISOString(),
    });
    return app;
  }

  async getApplicationById(applicationId: string, _session?: AuthenticatedUserSession): Promise<any> {
    return this.applicationsVault.get(applicationId);
  }

  async listApplications(_filter: any, _session?: AuthenticatedUserSession): Promise<any> {
    const all = Array.from(this.applicationsVault.values());
    return {
      data: all,
      total: all.length,
      limit: 50,
      offset: 0,
      counts: {
        total: all.length,
        draft: all.filter((a) => a.status === 'draft').length,
        submitted: all.filter((a) => a.status === 'submitted').length,
        under_review: all.filter((a) => a.status === 'under_review').length,
        approved: all.filter((a) => a.status === 'approved').length,
      },
    };
  }

  async checkCapacity(sectionId: string, academicYearId: string, _session?: AuthenticatedUserSession): Promise<any> {
    const enrolled = Array.from(this.academicRecordsVault.values()).filter(
      (r) => r.sectionId === sectionId && r.academicYearId === academicYearId
    ).length;
    return {
      sectionId,
      sectionName: 'A',
      gradeLevelId: 'grade-1',
      gradeLevelName: 'Grade 1',
      academicYearId,
      enrolledInSection: enrolled,
      sectionMaxCapacity: 40,
      isSectionAvailable: enrolled < 40,
      divisionGroup: 'primary',
      enrolledInDivisionGroup: enrolled,
      divisionGroupCapacity: 100,
      isDivisionGroupAvailable: enrolled < 100,
      isCapacityAvailable: enrolled < 40,
      utilizationPercentage: Math.round((enrolled / 40) * 100),
      divisionUtilizationPercentage: Math.round((enrolled / 100) * 100),
    };
  }

  async approveApplication(
    applicationId: string,
    payload: any,
    session?: AuthenticatedUserSession
  ): Promise<any> {
    if (session && session.role !== 'principal') {
      throw new AuthorizationError('Access Denied: Only Principal can approve student admission.');
    }
    const app = this.applicationsVault.get(applicationId);
    if (!app) throw new NotFoundError(`Application "${applicationId}" not found.`);

    const admissionNumber = await this.getNextAdmissionNumber(app.academicYearId, '2026-2027');
    const academicRecordId = randomUUID();

    const academicRecord = {
      id: academicRecordId,
      studentId: app.studentId,
      academicYearId: app.academicYearId,
      gradeLevelId: app.requestedGradeLevelId,
      sectionId: payload.sectionId,
      admissionNumber,
      status: 'admitted',
      admissionDate: new Date().toISOString().slice(0, 10),
      notes: payload.remarks || 'Principal approved admission.',
      createdAt: new Date().toISOString(),
    };
    this.academicRecordsVault.set(academicRecordId, academicRecord);

    app.status = 'approved';
    app.admissionNumber = admissionNumber;
    app.feeGenerated = true;

    return {
      applicationId,
      applicationNumber: app.applicationNumber,
      admissionNumber,
      studentId: app.studentId,
      studentAcademicRecordId: academicRecordId,
      sectionId: payload.sectionId,
      status: 'approved',
      approvedBy: session ? session.staffId : 'system',
      approvedAt: new Date().toISOString(),
      initialAssessmentId: randomUUID(),
      initialBilledAmountInr: formatInr('45000.00'),
      feeGenerated: true,
    };
  }

  async getAcademicRecordById(recordId: string, _session?: AuthenticatedUserSession): Promise<any> {
    return this.academicRecordsVault.get(recordId);
  }

  getAcademicRecordByIdSync(recordId: string): any {
    return this.academicRecordsVault.get(recordId);
  }

  async listAcademicRecordsForYear(academicYearId: string, _session?: AuthenticatedUserSession): Promise<any[]> {
    return Array.from(this.academicRecordsVault.values()).filter(
      (r) => r.academicYearId === academicYearId
    );
  }

  async getAllAcademicRecords(_session?: AuthenticatedUserSession): Promise<any[]> {
    return Array.from(this.academicRecordsVault.values());
  }

  getAllAcademicRecordsSync(): any[] {
    return Array.from(this.academicRecordsVault.values());
  }

  async getStudentById(studentId: string, _session?: AuthenticatedUserSession): Promise<any> {
    return this.studentsVault.get(studentId) || null;
  }

  getStudentByIdSync(studentId: string): any {
    return this.studentsVault.get(studentId) || null;
  }

  async getApplicationByRecordId(recordId: string, _session?: AuthenticatedUserSession): Promise<any> {
    const rec = this.academicRecordsVault.get(recordId);
    if (!rec) return null;
    for (const app of this.applicationsVault.values()) {
      if (app.studentId === rec.studentId && app.academicYearId === rec.academicYearId) {
        return app;
      }
    }
    return null;
  }

  getApplicationByRecordIdSync(recordId: string): any {
    const rec = this.academicRecordsVault.get(recordId);
    if (!rec) return null;
    for (const app of this.applicationsVault.values()) {
      if (app.studentId === rec.studentId && app.academicYearId === rec.academicYearId) {
        return app;
      }
    }
    return null;
  }

  async saveAcademicRecord(record: any): Promise<void> {
    this.academicRecordsVault.set(record.id, record);
  }

  async saveStudent(student: any): Promise<void> {
    this.studentsVault.set(student.id, student);
  }

  async getFeeAssessmentByRecordId(studentAcademicRecordId: string): Promise<any> {
    for (const a of this.feeAssessmentsVault.values()) {
      if (a.studentAcademicRecordId === studentAcademicRecordId) return a;
    }
    return null;
  }

  async saveFeeAssessment(assessment: any): Promise<void> {
    this.feeAssessmentsVault.set(assessment.id, assessment);
  }
}
