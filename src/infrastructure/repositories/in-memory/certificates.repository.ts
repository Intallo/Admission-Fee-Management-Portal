import { IAdmissionsRepository, ICertificatesRepository, IFeesLedgerRepository } from '../interfaces';
import { AuthenticatedUserSession } from '../../../modules/identity-access/types';
import {
  CertificateFilterDTO,
  CertificateKind,
  CertificateReviewStatus,
  CertificateState,
  CertificateVersionDTO,
  IssueCertificateResultDTO,
  StudentCertificateDTO,
} from '../../../modules/certificates-lctc/types';
import {
  AuthorizationError,
  BusinessRuleError,
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../../../lib/errors';
import { CertificateNumber, toDecimalInrString } from '../../../modules/shared/types';
import { randomUUID } from 'crypto';
import { compareInr, formatInr } from '../../../lib/money/inr';

export class InMemoryCertificatesRepository implements ICertificatesRepository {
  private certificatesVault = new Map<string, StudentCertificateDTO>();
  private versionsVault = new Map<string, CertificateVersionDTO[]>();
  private tcSeq = 1;
  private admissionsRepo?: IAdmissionsRepository;
  private feesRepo?: IFeesLedgerRepository;

  constructor(admissionsRepo?: IAdmissionsRepository, feesRepo?: IFeesLedgerRepository) {
    this.admissionsRepo = admissionsRepo;
    this.feesRepo = feesRepo;
  }

  setDependencies(admissionsRepo: IAdmissionsRepository, feesRepo: IFeesLedgerRepository): void {
    this.admissionsRepo = admissionsRepo;
    this.feesRepo = feesRepo;
  }

  resetForTesting(): void {
    this.certificatesVault.clear();
    this.versionsVault.clear();
    this.tcSeq = 1;
  }

  async getNextCertificateNumber(prefix?: string, _session?: AuthenticatedUserSession): Promise<string> {
    const padded = String(this.tcSeq++).padStart(4, '0');
    return `${prefix || 'TC'}-2026-${padded}`;
  }

  async prepopulateCertificate(
    studentAcademicRecordId: string,
    session?: AuthenticatedUserSession,
    extra?: any
  ): Promise<StudentCertificateDTO> {
    for (const existing of this.certificatesVault.values()) {
      if (existing.studentAcademicRecordId === studentAcademicRecordId) {
        throw new ConflictError('A certificate record already exists for this student in academic year.');
      }
    }

    let rec: any = null;
    let student: any = null;
    if (this.admissionsRepo) {
      try {
        rec = await this.admissionsRepo.getAcademicRecordById(studentAcademicRecordId);
        if (rec && rec.studentId) {
          student = await this.admissionsRepo.getStudentById(rec.studentId);
        }
        if (!student) {
          const app = await this.admissionsRepo.getApplicationByRecordId(studentAcademicRecordId);
          if (app && app.student) student = app.student;
        }
      } catch {}
    }

    let unpaidBalance = extra?.unpaidBalanceInr;
    if (!unpaidBalance && this.feesRepo) {
      try {
        const dues = await this.feesRepo.getStudentDuesSummary(studentAcademicRecordId);
        unpaidBalance = dues?.netBalanceDueInr || '0.00';
      } catch {
        unpaidBalance = '0.00';
      }
    }

    const certId = randomUUID();
    const nowIso = new Date().toISOString();
    const studentName = student
      ? `${student.firstName} ${student.lastName}`.trim()
      : extra?.studentName || 'Student';

    const cert: StudentCertificateDTO = {
      id: certId,
      studentAcademicRecordId,
      studentId: student?.id || extra?.studentId || randomUUID(),
      studentName,
      admissionNumber: rec?.admissionNumber || extra?.admissionNumber || 'ADM-2026-0001',
      gradeLevelId: rec?.gradeLevelId || extra?.gradeLevelId || '00000000-0000-0000-0000-000000000001',
      gradeLevelName: rec?.gradeLevelName || extra?.gradeLevelName || 'Standard 1',
      sectionId: rec?.sectionId || extra?.sectionId || '00000000-0000-0000-0000-000000000001',
      sectionName: rec?.sectionName || extra?.sectionName || 'Section A',
      academicYearId: rec?.academicYearId || extra?.academicYearId || '00000000-0000-0000-0000-000000000001',
      academicYearLabel: extra?.academicYearLabel || '2026-2027',
      certificateType: 'TC',
      certificateNumber: null,
      status: 'draft',
      reviewStatus: 'pending',
      reviewedBy: null,
      reviewedByName: null,
      reviewedAt: null,
      reviewRemarks: null,
      conduct: extra?.conduct || 'Good',
      progress: extra?.progress || 'Satisfactory',
      reasonForLeaving: extra?.reasonForLeaving || 'Annual completion / promotion',
      dateOfLeaving: extra?.dateOfLeaving || nowIso.slice(0, 10),
      intendedSchool: extra?.intendedSchool || null,
      unpaidBalanceInr: toDecimalInrString(unpaidBalance || '0.00'),
      duesOverrideReason: null,
      generatedBy: session ? session.staffId : null,
      approvedBy: null,
      approvedByName: null,
      issuedAt: null,
      versions: [],
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    this.certificatesVault.set(certId, cert);
    this.versionsVault.set(certId, []);
    return cert;
  }

  async getCertificateById(certificateId: string, _session?: AuthenticatedUserSession): Promise<StudentCertificateDTO | undefined> {
    const cert = this.certificatesVault.get(certificateId);
    if (!cert) return undefined;
    return {
      ...cert,
      versions: this.versionsVault.get(certificateId) || [],
    };
  }

  async getCertificateByStudentRecordId(studentRecordId: string, _session?: AuthenticatedUserSession): Promise<StudentCertificateDTO | undefined> {
    for (const c of this.certificatesVault.values()) {
      if (c.studentAcademicRecordId === studentRecordId) {
        return {
          ...c,
          versions: this.versionsVault.get(c.id) || [],
        };
      }
    }
    return undefined;
  }

  async reviewCertificate(
    certificateId: string,
    payload: any,
    session?: AuthenticatedUserSession
  ): Promise<StudentCertificateDTO> {
    const cert = this.certificatesVault.get(certificateId);
    if (!cert) {
      throw new NotFoundError(`Certificate "${certificateId}" not found.`);
    }

    if (cert.status !== 'draft') {
      throw new BusinessRuleError(`Cannot review certificate: Status is "${cert.status}". Only draft certificates can be reviewed.`);
    }

    const nowIso = new Date().toISOString();
    cert.reviewedBy = session ? session.staffId : null;
    cert.reviewedByName = session ? session.fullName : null;
    cert.reviewedAt = nowIso;
    cert.conduct = payload.conduct || cert.conduct;
    cert.progress = payload.progress || cert.progress;
    cert.reviewRemarks = payload.remarks || null;
    cert.reviewStatus = payload.action === 'forward_for_approval' ? 'reviewed' : 'returned';
    cert.updatedAt = nowIso;
    return cert;
  }

  async issueCertificate(
    certificateId: string,
    payload: any,
    session?: AuthenticatedUserSession
  ): Promise<IssueCertificateResultDTO> {
    if (session && session.role !== 'principal') {
      throw new AuthorizationError('Access Denied: Only the Principal holds authority to approve and issue certificates.');
    }
    const cert = this.certificatesVault.get(certificateId);
    if (!cert) {
      throw new NotFoundError(`Certificate "${certificateId}" not found.`);
    }

    if (cert.status !== 'draft') {
      throw new BusinessRuleError(`Cannot issue certificate: Certificate is already "${cert.status}".`);
    }

    if (cert.reviewStatus !== 'reviewed') {
      throw new BusinessRuleError(
        `Certificate must complete Step 1 (Admission Officer review) before Principal approval. Current review status is "${cert.reviewStatus}".`
      );
    }

    // Refresh dues from ledger
    if (this.feesRepo) {
      try {
        const dues = await this.feesRepo.getStudentDuesSummary(cert.studentAcademicRecordId);
        if (dues) {
          cert.unpaidBalanceInr = dues.netBalanceDueInr;
        }
      } catch {}
    }

    const hasDues = compareInr(cert.unpaidBalanceInr, '0.00') > 0;
    if (hasDues) {
      if (!payload.duesOverrideReason || payload.duesOverrideReason.trim().length < 5) {
        throw new BusinessRuleError(
          `Cannot issue certificate: Student has pending fee dues of ₹${cert.unpaidBalanceInr}. Principal dues override justification is required.`
        );
      }
      cert.duesOverrideReason = payload.duesOverrideReason.trim();
    } else {
      cert.duesOverrideReason = null;
    }

    const tcNumber = (await this.getNextCertificateNumber('TC')) as CertificateNumber;
    const nowIso = new Date().toISOString();

    cert.certificateNumber = tcNumber;
    cert.status = 'issued';
    cert.approvedBy = session ? session.staffId : null;
    cert.issuedAt = nowIso;
    cert.updatedAt = nowIso;

    const snapshot = {
      schoolName: 'ABC English Medium School',
      certificateType: cert.certificateType,
      certificateNumber: tcNumber,
      academicYearLabel: cert.academicYearLabel,
      studentName: cert.studentName,
      admissionNumber: cert.admissionNumber,
      admissionDate: '2026-04-01',
      stsNumber: null,
      gender: 'Male',
      dateOfBirth: '2015-05-15',
      dateOfBirthInWords: 'Fifteenth May Two Thousand Fifteen',
      placeOfBirth: 'Bengaluru',
      fatherName: 'Mr. Sharma',
      motherName: 'Mrs. Sharma',
      nationality: 'Indian',
      religion: 'Hindu',
      caste: null,
      subCaste: null,
      standardStudied: cert.gradeLevelName,
      lastClassStudied: cert.gradeLevelName,
      previousSchoolAttended: null,
      dateOfLeaving: cert.dateOfLeaving,
      reasonForLeaving: cert.reasonForLeaving,
      conduct: cert.conduct,
      progress: cert.progress,
      feeDuesStatus: hasDues ? 'dues_pending_with_override' : 'cleared',
      feeDuesAmountInr: cert.unpaidBalanceInr,
      duesOverrideReason: cert.duesOverrideReason,
      remarks: payload.remarks || null,
      issueDate: nowIso.slice(0, 10),
      signatories: {
        clerkSignatureLine: 'Office Superintendent / Clerk',
        admissionOfficerSignatureLine: 'Admission Officer',
        principalSignatureLine: 'Principal & Head of Institution',
      },
    };

    const version1: CertificateVersionDTO = {
      id: randomUUID(),
      studentYearCertificateId: cert.id,
      versionNumber: 1,
      contentSnapshot: snapshot as any,
      templateVersion: 'v1.4-official',
      pdfStorageBucket: 'certificates',
      pdfStorageObjectKey: `certificates/2026/${tcNumber}-v1.pdf`,
      issueOrReissueReason: 'Initial formal issuance',
      generatedBy: session ? session.staffId : null,
      approvedBy: session ? session.staffId : null,
      isDuplicate: false,
      duplicateLabel: null,
      generatedAt: nowIso,
    };

    const versions = this.versionsVault.get(certificateId) || [];
    versions.push(version1);
    this.versionsVault.set(certificateId, versions);

    return {
      certificateId: cert.id,
      certificateNumber: tcNumber,
      certificateType: cert.certificateType,
      status: 'issued',
      versionNumber: 1,
      studentName: cert.studentName,
      approvedBy: session ? session.staffId : '00000000-0000-0000-0000-000000000000',
      issuedAt: nowIso,
      pdfStorageKey: `certificates/2026/${tcNumber}-v1.pdf`,
    };
  }

  async reprintCertificate(
    certificateId: string,
    reason: string,
    session?: AuthenticatedUserSession
  ): Promise<any> {
    const cert = this.certificatesVault.get(certificateId);
    if (!cert) {
      throw new NotFoundError(`Certificate "${certificateId}" not found.`);
    }

    if (cert.status !== 'issued') {
      throw new BusinessRuleError('Cannot reprint unissued certificate.');
    }

    const versions = this.versionsVault.get(certificateId) || [];
    const newVersionNumber = versions.length + 1;
    const nowIso = new Date().toISOString();

    const duplicateVersion: CertificateVersionDTO = {
      id: randomUUID(),
      studentYearCertificateId: cert.id,
      versionNumber: newVersionNumber,
      contentSnapshot: versions[0]?.contentSnapshot || ({} as any),
      templateVersion: 'v1.4-official',
      pdfStorageBucket: 'certificates',
      pdfStorageObjectKey: `certificates/2026/${cert.certificateNumber}-v${newVersionNumber}.pdf`,
      issueOrReissueReason: reason,
      generatedBy: session ? session.staffId : null,
      approvedBy: cert.approvedBy,
      isDuplicate: true,
      duplicateLabel: 'DUPLICATE COPY',
      generatedAt: nowIso,
    };
    versions.push(duplicateVersion);
    this.versionsVault.set(certificateId, versions);

    return {
      certificateId: cert.id,
      certificateNumber: cert.certificateNumber,
      newVersionNumber,
      reason,
      reprintedAt: nowIso,
      pdfDownloadUrl: `/api/v1/certificates/${certificateId}/pdf`,
    };
  }

  async listCertificates(filter?: CertificateFilterDTO, _session?: AuthenticatedUserSession): Promise<{ data: StudentCertificateDTO[]; total: number }> {
    let list = Array.from(this.certificatesVault.values());
    if (filter?.academicYearId && filter.academicYearId !== 'all') {
      list = list.filter((c) => c.academicYearId === filter.academicYearId);
    }
    if (filter?.gradeLevelId) {
      list = list.filter((c) => c.gradeLevelId === filter.gradeLevelId);
    }
    if (filter?.status && filter.status !== 'all') {
      list = list.filter((c) => c.status === filter.status);
    }
    return {
      data: list,
      total: list.length,
    };
  }
}
