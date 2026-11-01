import {
  CertificateFilterDTO,
  IssueCertificateRequestDTO,
  IssueCertificateResultDTO,
  ReprintCertificateRequestDTO,
  ReprintCertificateResultDTO,
  RequestCertificateRequestDTO,
  ReviewCertificateRequestDTO,
  StudentCertificateDTO,
} from './types';
import { AuthenticatedUserSession } from '../identity-access/types';
import {
  NotFoundError,
} from '../../lib/errors';
import { enforcePolicy } from '../../policy/guards';
import { academicYearsService } from '../academic-years/service';
import { admissionsService } from '../admissions/service';
import { CertificateNumber } from '../shared/types';
import { ICertificatesRepository } from '../../infrastructure/repositories/interfaces';
import { getRepositories } from '../../infrastructure/repositories/registry';
import { auditReportingService } from '../audit-reporting/service';

export class CertificatesService {
  private customRepo?: ICertificatesRepository;
  private tcSeq = 1;

  constructor(customRepo?: ICertificatesRepository) {
    this.customRepo = customRepo;
  }

  private get repo(): ICertificatesRepository {
    return this.customRepo ?? getRepositories().certificates;
  }

  resetForTesting(): void {
    this.tcSeq = 1;
    if (this.repo.resetForTesting) {
      this.repo.resetForTesting();
    }
  }

  getNextTcNumber(yearLabel: string): CertificateNumber {
    const yearPrefix = yearLabel.slice(0, 4);
    const padded = String(this.tcSeq++).padStart(4, '0');
    return `TC-${yearPrefix}-${padded}` as CertificateNumber;
  }

  async prepopulateYearCertificates(
    academicYearId: string,
    session: AuthenticatedUserSession
  ): Promise<{ createdCount: number }> {
    enforcePolicy(session.role, 'certificates:request_tc');

    await academicYearsService.getAcademicYearById(academicYearId);
    await academicYearsService.assertYearIsNotClosed(academicYearId);

    const records = admissionsService.getAllAcademicRecords().filter((r) => r.academicYearId === academicYearId);
    let createdCount = 0;
    for (const rec of records) {
      try {
        await this.repo.prepopulateCertificate(rec.id, session, { academicYearId });
        createdCount++;
      } catch {
        // already exists
      }
    }

    return { createdCount };
  }

  async requestCertificate(
    payload: RequestCertificateRequestDTO,
    session: AuthenticatedUserSession
  ): Promise<StudentCertificateDTO> {
    enforcePolicy(session.role, 'certificates:request_tc');

    return this.repo.prepopulateCertificate(payload.studentAcademicRecordId, session, payload);
  }

  async getCertificateById(
    certificateId: string,
    session: AuthenticatedUserSession
  ): Promise<StudentCertificateDTO> {
    enforcePolicy(session.role, 'certificates:request_tc');

    const cert = await this.repo.getCertificateById(certificateId, session);
    if (!cert) {
      throw new NotFoundError(`Certificate record with ID "${certificateId}" not found.`);
    }

    return cert;
  }

  async listCertificatesForRecord(
    studentAcademicRecordId: string
  ): Promise<Array<{ id: string; certificateType: 'LC' | 'TC'; certificateNumber: string | null; status: 'draft' | 'issued' | 'cancelled'; reviewStatus?: 'pending' | 'reviewed' | 'returned'; issuedAt: string | null }>> {
    const cert = await this.repo.getCertificateByStudentRecordId(studentAcademicRecordId);
    if (!cert) return [];

    return [
      {
        id: cert.id,
        certificateType: (cert as any).certificateType || (cert as any).certificateKind || 'TC',
        certificateNumber: cert.certificateNumber,
        status: cert.status,
        reviewStatus: cert.reviewStatus,
        issuedAt: (cert as any).issuedAt || null,
      },
    ];
  }

  async reviewCertificate(
    certificateId: string,
    payload: ReviewCertificateRequestDTO,
    session: AuthenticatedUserSession
  ): Promise<StudentCertificateDTO> {
    enforcePolicy(session.role, 'certificates:review_tc');

    return this.repo.reviewCertificate(certificateId, payload, session);
  }

  async batchReviewCertificates(
    payload: { certificateIds: string[]; action: 'forward_for_approval' | 'return_to_draft'; remarks?: string },
    session: AuthenticatedUserSession
  ): Promise<{ processedCount: number; updatedCertificates: StudentCertificateDTO[] }> {
    enforcePolicy(session.role, 'certificates:review_tc');

    const results: StudentCertificateDTO[] = [];
    for (const id of payload.certificateIds) {
      const res = await this.reviewCertificate(id, {
        action: payload.action,
        conduct: 'Good',
        progress: 'Satisfactory',
        remarks: payload.remarks,
      }, session);
      results.push(res);
    }

    return { processedCount: results.length, updatedCertificates: results };
  }

  async issueCertificate(
    certificateId: string,
    payload: IssueCertificateRequestDTO,
    session: AuthenticatedUserSession
  ): Promise<IssueCertificateResultDTO> {
    enforcePolicy(session.role, 'certificates:issue_tc');

    const result = await this.repo.issueCertificate(certificateId, payload, session);
    return {
      certificateId: (result as any).certificateId || result.id,
      certificateNumber: (result as any).certificateNumber || (result as any).certificate_number,
      certificateType: (result as any).certificateType || (result as any).certificateKind || 'TC',
      status: 'issued',
      versionNumber: (result as any).versionNumber || 1,
      studentName: (result as any).studentName || 'Student Name',
      approvedBy: session.staffId,
      issuedAt: (result as any).issuedAt || new Date().toISOString(),
      pdfStorageKey: (result as any).pdfStorageKey || `certificates/2026/${(result as any).certificateNumber}-v1.pdf`,
    };
  }

  async reprintCertificate(
    certificateId: string,
    payload: ReprintCertificateRequestDTO,
    session: AuthenticatedUserSession
  ): Promise<ReprintCertificateResultDTO> {
    enforcePolicy(session.role, 'certificates:reprint_tc');

    const result = await this.repo.reprintCertificate(certificateId, payload.reason, session);
    await auditReportingService.recordAuditEvent({
      action: 'CERTIFICATE_REPRINTED',
      actorStaffId: session.staffId,
      actorName: session.fullName,
      actorRole: session.role,
      entityType: 'student_year_certificates',
      entityId: certificateId,
      reason: payload.reason,
      outcome: 'success',
      afterSnapshot: {
        certificateId,
        newVersionNumber: result.newVersionNumber,
        reason: payload.reason,
      },
    }).catch(() => {});
    return result;
  }

  async listCertificates(
    filter: CertificateFilterDTO,
    session: AuthenticatedUserSession
  ): Promise<{ data: StudentCertificateDTO[]; total: number }> {
    enforcePolicy(session.role, 'certificates:request_tc');

    return this.repo.listCertificates(filter, session);
  }
}

export const certificatesService = new CertificatesService();
