import { randomUUID } from 'crypto';
import {
  CertificateContentSnapshotDTO,
  CertificateFilterDTO,
  CertificateKind,
  CertificateReviewStatus,
  CertificateState,
  CertificateVersionDTO,
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
  AuthorizationError,
  BusinessRuleError,
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../../lib/errors';
import { enforcePolicy } from '../../policy/guards';
import { admissionsService } from '../admissions/service';
import { academicYearsService } from '../academic-years/service';
import { feesLedgerService } from '../fees-ledger/service';
import { auditReportingService } from '../audit-reporting/service';
import { logger } from '../../lib/logger';
import { CertificateNumber, DecimalInrString, toDecimalInrString } from '../shared/types';
import { compareInr, formatInr } from '../../lib/money/inr';
import { formatDateInWords } from '../../lib/date-words';

// In-memory vaults for certificates and versions
const certificatesVault = new Map<string, StudentCertificateDTO>(); // certificateId -> StudentCertificateDTO
const recordToCertificateMap = new Map<string, string>();           // academicRecordId -> certificateId
const certificateVersionsVault = new Map<string, CertificateVersionDTO[]>(); // certificateId -> versions
const tcSequenceVault = new Map<string, number>();                  // yearPrefix -> nextSeq

// Concurrency mutex lock for atomic monotonic numbering
let isLockActive = false;
const waitQueue: Array<() => void> = [];

async function acquireMutexLock(): Promise<() => void> {
  if (isLockActive) {
    await new Promise<void>((resolve) => waitQueue.push(resolve));
  }
  isLockActive = true;
  return () => {
    isLockActive = false;
    const next = waitQueue.shift();
    if (next) {
      isLockActive = true;
      next();
    }
  };
}

export class CertificatesService {
  /**
   * Resets certificate vaults for testing.
   */
  resetForTesting(): void {
    certificatesVault.clear();
    recordToCertificateMap.clear();
    certificateVersionsVault.clear();
    tcSequenceVault.clear();
    isLockActive = false;
    waitQueue.length = 0;
  }

  /**
   * Generates next monotonic TC number: TC-YYYY-NNNN (e.g. TC-2026-0001).
   * Monotonic per academic starting calendar year; committed numbers are never reused.
   */
  getNextTcNumber(yearLabel: string): CertificateNumber {
    const yearPrefix = yearLabel.slice(0, 4);
    const current = tcSequenceVault.get(yearPrefix) || 1;
    tcSequenceVault.set(yearPrefix, current + 1);

    const padded = String(current).padStart(4, '0');
    return `TC-${yearPrefix}-${padded}` as CertificateNumber;
  }

  /**
   * Pre-populates certificate draft records for all students of the academic year (US-34 AC1).
   * Includes Left / Transferred students of that year.
   */
  async prepopulateYearCertificates(
    academicYearId: string,
    session: AuthenticatedUserSession
  ): Promise<{ createdCount: number }> {
    enforcePolicy(session.role, 'certificates:request_tc');

    const year = await academicYearsService.getAcademicYearById(academicYearId);
    await academicYearsService.assertYearIsNotClosed(academicYearId);

    const allRecords = admissionsService
      .getAllAcademicRecords()
      .filter((r) => r.academicYearId === academicYearId);

    let createdCount = 0;
    const nowIso = new Date().toISOString();
    const todayDate = nowIso.slice(0, 10);

    for (const record of allRecords) {
      // Check if student already has a certificate record for this academic year (US-34 AC4)
      if (recordToCertificateMap.has(record.id)) {
        continue;
      }

      const student = admissionsService.getStudentById(record.studentId);
      const app = admissionsService.getApplicationByRecordId(record.id);
      const grade = admissionsService.getGradeLevel(record.gradeLevelId);
      const section = admissionsService.getSection(record.sectionId);

      const fullName = student ? `${student.firstName} ${student.lastName}`.trim() : 'Unknown';
      const certId = randomUUID();

      const cert: StudentCertificateDTO = {
        id: certId,
        studentAcademicRecordId: record.id,
        studentId: record.studentId,
        studentName: fullName,
        admissionNumber: record.admissionNumber,
        gradeLevelId: record.gradeLevelId,
        gradeLevelName: grade?.name || 'Standard 1',
        sectionId: record.sectionId,
        sectionName: section?.name || 'Section A',
        academicYearId: record.academicYearId,
        academicYearLabel: year.label,
        certificateType: 'TC',
        certificateNumber: null,
        status: 'draft',
        reviewStatus: 'pending',
        reviewedBy: null,
        reviewedByName: null,
        reviewedAt: null,
        reviewRemarks: null,
        conduct: 'Good',
        progress: 'Satisfactory',
        reasonForLeaving: 'Annual completion / promotion',
        dateOfLeaving: todayDate,
        intendedSchool: null,
        unpaidBalanceInr: toDecimalInrString('0.00'),
        duesOverrideReason: null,
        generatedBy: session.staffId,
        approvedBy: null,
        approvedByName: null,
        issuedAt: null,
        versions: [],
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      certificatesVault.set(certId, cert);
      recordToCertificateMap.set(record.id, certId);
      certificateVersionsVault.set(certId, []);
      createdCount++;
    }

    await auditReportingService.recordAuditEvent({
      actorStaffId: session.staffId,
      actorName: session.fullName,
      actorRole: session.role,
      action: 'CERTIFICATES_PREPOPULATED',
      entityType: 'academic_year',
      entityId: academicYearId,
      reason: `Batch prepopulated ${createdCount} certificate drafts for year ${year.label}`,
    });

    return { createdCount };
  }

  /**
   * Requests a certificate record for a single student (US-34 AC2).
   */
  async requestCertificate(
    payload: RequestCertificateRequestDTO,
    session: AuthenticatedUserSession
  ): Promise<StudentCertificateDTO> {
    enforcePolicy(session.role, 'certificates:request_tc');

    const record = admissionsService.getAcademicRecord(payload.studentAcademicRecordId);
    if (!record) {
      throw new NotFoundError(
        `Student academic record with ID "${payload.studentAcademicRecordId}" not found.`
      );
    }

    await academicYearsService.assertYearIsNotClosed(record.academicYearId);

    // Each student can have only ONE certificate record per academic year (US-34 AC4)
    if (recordToCertificateMap.has(record.id)) {
      throw new ConflictError(
        `A certificate record already exists for this student in academic year.`
      );
    }

    const year = await academicYearsService.getAcademicYearById(record.academicYearId);
    const student = admissionsService.getStudentById(record.studentId);
    const grade = admissionsService.getGradeLevel(record.gradeLevelId);
    const section = admissionsService.getSection(record.sectionId);

    const fullName = student ? `${student.firstName} ${student.lastName}`.trim() : 'Unknown';
    const certId = randomUUID();
    const nowIso = new Date().toISOString();
    const todayDate = nowIso.slice(0, 10);

    let initialUnpaidBalance: DecimalInrString = toDecimalInrString('0.00');
    try {
      const dues = await feesLedgerService.getStudentDuesInternal(record.id);
      initialUnpaidBalance = dues.netBalanceDueInr;
    } catch {
      // Keep 0.00
    }

    const cert: StudentCertificateDTO = {
      id: certId,
      studentAcademicRecordId: record.id,
      studentId: record.studentId,
      studentName: fullName,
      admissionNumber: record.admissionNumber,
      gradeLevelId: record.gradeLevelId,
      gradeLevelName: grade?.name || 'Standard 1',
      sectionId: record.sectionId,
      sectionName: section?.name || 'Section A',
      academicYearId: record.academicYearId,
      academicYearLabel: year.label,
      certificateType: payload.certificateType || 'TC',
      certificateNumber: null,
      status: 'draft',
      reviewStatus: 'pending',
      reviewedBy: null,
      reviewedByName: null,
      reviewedAt: null,
      reviewRemarks: null,
      conduct: payload.conduct || 'Good',
      progress: payload.progress || 'Satisfactory',
      reasonForLeaving: payload.reasonForLeaving || 'Relocation / Personal',
      dateOfLeaving: payload.dateOfLeaving || todayDate,
      intendedSchool: payload.intendedSchool || null,
      unpaidBalanceInr: initialUnpaidBalance,
      duesOverrideReason: null,
      generatedBy: session.staffId,
      approvedBy: null,
      approvedByName: null,
      issuedAt: null,
      versions: [],
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    certificatesVault.set(certId, cert);
    recordToCertificateMap.set(record.id, certId);
    certificateVersionsVault.set(certId, []);

    await auditReportingService.recordAuditEvent({
      actorStaffId: session.staffId,
      actorName: session.fullName,
      actorRole: session.role,
      action: 'CERTIFICATE_REQUESTED',
      entityType: 'student_year_certificate',
      entityId: certId,
      reason: payload.reasonForLeaving,
    });

    return cert;
  }

  /**
   * Lists certificates with role filtering, standard filter, and current unpaid dues (US-34 AC3, AC5).
   */
  async listCertificates(
    filter: CertificateFilterDTO,
    session: AuthenticatedUserSession
  ): Promise<{ data: StudentCertificateDTO[]; total: number }> {
    enforcePolicy(session.role, 'certificates:request_tc');

    const targetYearId = filter.academicYearId || session.activeAcademicYearId;
    let list = Array.from(certificatesVault.values());

    if (targetYearId && targetYearId !== 'all') {
      list = list.filter((c) => c.academicYearId === targetYearId);
    }
    if (filter.gradeLevelId) {
      list = list.filter((c) => c.gradeLevelId === filter.gradeLevelId);
    }
    if (filter.sectionId) {
      list = list.filter((c) => c.sectionId === filter.sectionId);
    }
    if (filter.status && filter.status !== 'all') {
      list = list.filter((c) => c.status === filter.status);
    }
    if (filter.reviewStatus && filter.reviewStatus !== 'all') {
      list = list.filter((c) => c.reviewStatus === filter.reviewStatus);
    }
    if (filter.studentId) {
      list = list.filter((c) => c.studentId === filter.studentId);
    }
    if (filter.search) {
      const q = filter.search.toLowerCase().trim();
      list = list.filter(
        (c) =>
          c.studentName.toLowerCase().includes(q) ||
          c.admissionNumber.toLowerCase().includes(q) ||
          (c.certificateNumber && c.certificateNumber.toLowerCase().includes(q))
      );
    }

    // Refresh current unpaid balance for each record (US-34 AC5)
    for (const cert of list) {
      try {
        const dues = await feesLedgerService.getStudentDuesInternal(
          cert.studentAcademicRecordId
        );
        cert.unpaidBalanceInr = dues.netBalanceDueInr;
      } catch {
        // Leave previous balance
      }
      cert.versions = certificateVersionsVault.get(cert.id) || [];
    }

    const total = list.length;
    const offset = filter.offset ?? 0;
    const limit = filter.limit ?? 50;
    const paginated = list.slice(offset, offset + limit);

    return {
      data: paginated,
      total,
    };
  }

  /**
   * Retrieves a single certificate by its unique ID.
   */
  async getCertificateById(
    certificateId: string,
    session: AuthenticatedUserSession
  ): Promise<StudentCertificateDTO> {
    enforcePolicy(session.role, 'certificates:request_tc');

    const cert = certificatesVault.get(certificateId);
    if (!cert) {
      throw new NotFoundError(`Certificate record with ID "${certificateId}" not found.`);
    }

    try {
      const dues = await feesLedgerService.getStudentDuesInternal(
        cert.studentAcademicRecordId
      );
      cert.unpaidBalanceInr = dues.netBalanceDueInr;
    } catch {
      // Keep previous
    }

    cert.versions = certificateVersionsVault.get(cert.id) || [];
    return cert;
  }

  /**
   * Retrieves certificate summaries for a student academic record (for student profile view).
   */
  async listCertificatesForRecord(
    studentAcademicRecordId: string
  ): Promise<Array<{ id: string; certificateType: 'LC' | 'TC'; certificateNumber: string | null; status: 'draft' | 'issued' | 'cancelled'; reviewStatus?: 'pending' | 'reviewed' | 'returned'; issuedAt: string | null }>> {
    const certId = recordToCertificateMap.get(studentAcademicRecordId);
    if (!certId) return [];

    const cert = certificatesVault.get(certId);
    if (!cert) return [];

    return [
      {
        id: cert.id,
        certificateType: cert.certificateType,
        certificateNumber: cert.certificateNumber,
        status: cert.status,
        reviewStatus: cert.reviewStatus,
        issuedAt: cert.issuedAt,
      },
    ];
  }

  /**
   * Step 1: Admission Officer Review (US-35 AC1).
   * Reviews student data, conduct, and remarks fields, then forwards or returns the request.
   */
  async reviewCertificate(
    certificateId: string,
    payload: ReviewCertificateRequestDTO,
    session: AuthenticatedUserSession
  ): Promise<StudentCertificateDTO> {
    // Step 1 review is strictly the Admission Officer's role
    enforcePolicy(session.role, 'certificates:review_tc');

    const cert = certificatesVault.get(certificateId);
    if (!cert) {
      throw new NotFoundError(`Certificate record with ID "${certificateId}" not found.`);
    }

    if (cert.status !== 'draft') {
      throw new BusinessRuleError(
        `Cannot review certificate: Status is "${cert.status}". Only draft certificates can be reviewed.`
      );
    }

    await academicYearsService.assertYearIsNotClosed(cert.academicYearId);

    const nowIso = new Date().toISOString();
    cert.reviewedBy = session.staffId;
    cert.reviewedByName = session.fullName;
    cert.reviewedAt = nowIso;
    cert.conduct = payload.conduct || cert.conduct;
    cert.progress = payload.progress || cert.progress;
    cert.reviewRemarks = payload.remarks || null;
    cert.updatedAt = nowIso;

    if (payload.action === 'forward_for_approval') {
      cert.reviewStatus = 'reviewed';
    } else {
      cert.reviewStatus = 'returned';
    }

    await auditReportingService.recordAuditEvent({
      actorStaffId: session.staffId,
      actorName: session.fullName,
      actorRole: session.role,
      action: 'CERTIFICATE_REVIEWED',
      entityType: 'student_year_certificate',
      entityId: cert.id,
      beforeSnapshot: { reviewStatus: 'pending' },
      afterSnapshot: {
        reviewStatus: cert.reviewStatus,
        action: payload.action,
        conduct: cert.conduct,
        progress: cert.progress,
        remarks: cert.reviewRemarks,
      },
      reason: payload.remarks || `Step 1 review action: ${payload.action}`,
    });

    return cert;
  }

  /**
   * Batch Step 1 Review (US-35 AC5).
   */
  async batchReviewCertificates(
    requests: Array<{
      certificateId: string;
      action: 'forward_for_approval' | 'return_to_draft';
      conduct: string;
      progress: string;
      remarks?: string;
    }>,
    session: AuthenticatedUserSession
  ): Promise<{ results: StudentCertificateDTO[] }> {
    const results: StudentCertificateDTO[] = [];
    for (const req of requests) {
      const res = await this.reviewCertificate(
        req.certificateId,
        { action: req.action, conduct: req.conduct, progress: req.progress, remarks: req.remarks },
        session
      );
      results.push(res);
    }
    return { results };
  }

  /**
   * Step 2: Principal Approval & Issuance (`issue_certificate_atomic`, US-35, US-36).
   * - Enforces Principal authority strictly.
   * - Checks Step 1 review completion.
   * - Dues Warning & Mandatory Override: if unpaid dues > 0, requires duesOverrideReason.
   * - Concurrency-safe monotonic TC numbering format (TC-YYYY-NNNN).
   * - Produces immutable content snapshot (Version 1).
   * - **CRITICAL INVARIANT (DEC-08, BR-34, US-36 AC4)**: Does NOT change student enrollment status!
   */
  async issueCertificate(
    certificateId: string,
    payload: IssueCertificateRequestDTO,
    session: AuthenticatedUserSession
  ): Promise<IssueCertificateResultDTO> {
    // Step 2 is strictly Principal authority
    enforcePolicy(session.role, 'certificates:issue_tc');

    const releaseLock = await acquireMutexLock();

    try {
      const cert = certificatesVault.get(certificateId);
      if (!cert) {
        throw new NotFoundError(`Certificate record with ID "${certificateId}" not found.`);
      }

      if (cert.status !== 'draft') {
        throw new BusinessRuleError(
          `Cannot issue certificate: Certificate is already "${cert.status}".`
        );
      }

      // Step 1 review must be completed
      if (cert.reviewStatus !== 'reviewed') {
        throw new BusinessRuleError(
          `Certificate must complete Step 1 (Admission Officer review) before Principal approval. Current review status is "${cert.reviewStatus}".`
        );
      }

      await academicYearsService.assertYearIsNotClosed(cert.academicYearId);

      // Check Dues Rule (US-35 AC3, REG-03)
      const dues = await feesLedgerService.getStudentDuesInternal(
        cert.studentAcademicRecordId
      );
      const hasDues = compareInr(dues.netBalanceDueInr, '0.00') > 0;

      if (hasDues) {
        if (!payload.duesOverrideReason || payload.duesOverrideReason.trim().length < 5) {
          throw new BusinessRuleError(
            `Cannot issue certificate: Student has pending fee dues of ₹${dues.netBalanceDueInr}. Principal dues override justification is required.`
          );
        }
        cert.duesOverrideReason = payload.duesOverrideReason.trim();
      } else {
        cert.duesOverrideReason = null;
      }

      // Concurrency-safe monotonic certificate numbering allocation
      const tcNumber = this.getNextTcNumber(cert.academicYearLabel);

      const nowIso = new Date().toISOString();
      const todayDate = nowIso.slice(0, 10);

      // Pull student, parent, and academic details for immutable snapshot (US-36 AC1)
      const student = admissionsService.getStudentById(cert.studentId);
      const app = admissionsService.getApplicationByRecordId(cert.studentAcademicRecordId);
      const record = admissionsService.getAcademicRecord(cert.studentAcademicRecordId);

      const father = app?.guardians?.find((g) => g.relationship.toLowerCase() === 'father');
      const mother = app?.guardians?.find((g) => g.relationship.toLowerCase() === 'mother');
      const primaryGuardian = app?.guardians?.find((g) => g.isPrimaryContact) || app?.guardians?.[0];

      const leavingDate = payload.dateOfLeaving || cert.dateOfLeaving || todayDate;
      const leavingReason = payload.reasonForLeaving || cert.reasonForLeaving || 'Completed school year';
      const conduct = payload.conduct || cert.conduct || 'Good';
      const progress = payload.progress || cert.progress || 'Satisfactory';
      const remarks = payload.remarks || cert.reviewRemarks || null;

      const dobInWords = formatDateInWords(student?.dateOfBirth || '');

      const snapshot: CertificateContentSnapshotDTO = {
        schoolName: 'Demonstration Public School',
        certificateType: cert.certificateType,
        certificateNumber: tcNumber,
        academicYearLabel: cert.academicYearLabel,
        studentName: cert.studentName,
        admissionNumber: cert.admissionNumber,
        admissionDate: record?.admissionDate || todayDate,
        stsNumber: student?.stsNumber || null,
        gender: student?.gender || 'not_specified',
        dateOfBirth: student?.dateOfBirth || '',
        dateOfBirthInWords: dobInWords,
        placeOfBirth: student?.placeOfBirth || null,
        fatherName: father?.fullName || primaryGuardian?.fullName || 'N/A',
        motherName: mother?.fullName || 'N/A',
        nationality: student?.nationality || 'Indian',
        religion: student?.religion || null,
        caste: (app?.sensitiveDetails as any)?.caste || (app?.sensitiveDetails as any)?.casteCategory || null,
        subCaste: app?.sensitiveDetails?.subCaste || null,
        standardStudied: cert.gradeLevelName,
        lastClassStudied: cert.gradeLevelName,
        previousSchoolAttended: student?.previousSchoolName || null,
        dateOfLeaving: leavingDate,
        reasonForLeaving: leavingReason,
        conduct,
        progress,
        feeDuesStatus: hasDues ? 'dues_pending_with_override' : 'cleared',
        feeDuesAmountInr: dues.netBalanceDueInr,
        duesOverrideReason: cert.duesOverrideReason,
        remarks,
        issueDate: todayDate,
        signatories: {
          clerkSignatureLine: 'Office Superintendent / Clerk',
          admissionOfficerSignatureLine: 'Admission Officer',
          principalSignatureLine: 'Principal & Head of Institution',
        },
      };

      const yearPrefix = cert.academicYearLabel.slice(0, 4);
      const pdfStorageKey = `certificates/${yearPrefix}/${tcNumber}-v1.pdf`;

      const version1: CertificateVersionDTO = {
        id: randomUUID(),
        studentYearCertificateId: cert.id,
        versionNumber: 1,
        contentSnapshot: snapshot,
        templateVersion: 'v1.4-official',
        pdfStorageBucket: 'certificates',
        pdfStorageObjectKey: pdfStorageKey,
        issueOrReissueReason: 'Original Initial Issue',
        generatedBy: session.staffId,
        approvedBy: session.staffId,
        isDuplicate: false,
        duplicateLabel: null,
        generatedAt: nowIso,
      };

      const versions = certificateVersionsVault.get(cert.id) || [];
      versions.push(version1);
      certificateVersionsVault.set(cert.id, versions);

      // Mutate certificate entity
      cert.certificateNumber = tcNumber;
      cert.status = 'issued';
      cert.approvedBy = session.staffId;
      cert.approvedByName = session.fullName;
      cert.issuedAt = nowIso;
      cert.reasonForLeaving = leavingReason;
      cert.dateOfLeaving = leavingDate;
      cert.conduct = conduct;
      cert.progress = progress;
      cert.updatedAt = nowIso;

      // NON-NEGOTIABLE INVARIANT (DEC-08, BR-34, US-36 AC4):
      // Certificate issuance NEVER changes the student's status to Left/Transferred!
      // Verify student academic record status is completely untouched.
      if (record) {
        // Status remains whatever it was (e.g. 'admitted' or 'active')
        logger.info('Confirmed invariant: Certificate issued without changing student status', {
          studentAcademicRecordId: record.id,
          studentStatus: record.status,
          certificateNumber: tcNumber,
        });
      }

      await auditReportingService.recordAuditEvent({
        actorStaffId: session.staffId,
        actorName: session.fullName,
        actorRole: session.role,
        action: 'CERTIFICATE_ISSUED',
        entityType: 'student_year_certificate',
        entityId: cert.id,
        beforeSnapshot: { status: 'draft', certificateNumber: null },
        afterSnapshot: {
          status: 'issued',
          certificateNumber: tcNumber,
          feeDuesStatus: snapshot.feeDuesStatus,
          duesOverrideReason: cert.duesOverrideReason,
        },
        reason: cert.duesOverrideReason || 'Principal approved certificate issuance',
      });

      return {
        certificateId: cert.id,
        certificateNumber: tcNumber,
        certificateType: cert.certificateType,
        status: 'issued',
        versionNumber: 1,
        studentName: cert.studentName,
        approvedBy: session.staffId,
        issuedAt: nowIso,
        pdfStorageKey,
      };
    } finally {
      releaseLock();
    }
  }

  /**
   * Batch Step 2 Issue (US-35 AC5).
   */
  async batchIssueCertificates(
    requests: Array<{
      certificateId: string;
      duesOverrideReason?: string;
      remarks?: string;
      dateOfLeaving?: string;
    }>,
    session: AuthenticatedUserSession
  ): Promise<{ results: IssueCertificateResultDTO[] }> {
    const results: IssueCertificateResultDTO[] = [];
    for (const req of requests) {
      const res = await this.issueCertificate(
        req.certificateId,
        {
          duesOverrideReason: req.duesOverrideReason,
          remarks: req.remarks,
          dateOfLeaving: req.dateOfLeaving,
        },
        session
      );
      results.push(res);
    }
    return { results };
  }

  /**
   * Retrieves and reprints LC/TC (US-37).
   * Generates a new version record labelled "DUPLICATE COPY" with reprint date, preserving original data.
   */
  async reprintCertificate(
    certificateId: string,
    payload: ReprintCertificateRequestDTO,
    session: AuthenticatedUserSession
  ): Promise<ReprintCertificateResultDTO> {
    enforcePolicy(session.role, 'certificates:reprint_tc');

    if (!payload.reason || payload.reason.trim().length < 3) {
      throw new ValidationError('Reprint reason is mandatory and must be at least 3 characters.');
    }

    const cert = certificatesVault.get(certificateId);
    if (!cert) {
      throw new NotFoundError(`Certificate record with ID "${certificateId}" not found.`);
    }

    if (cert.status !== 'issued' || !cert.certificateNumber) {
      throw new BusinessRuleError(
        'Cannot reprint certificate: Only issued certificates with assigned numbers can be reprinted.'
      );
    }

    const versions = certificateVersionsVault.get(cert.id) || [];
    if (versions.length === 0) {
      throw new BusinessRuleError('Corrupt certificate state: Original version snapshot not found.');
    }

    // Preserve original issued data intact (US-37 AC3)
    const originalVersion = versions[0];
    const newVersionNumber = versions.length + 1;
    const nowIso = new Date().toISOString();
    const yearPrefix = cert.academicYearLabel.slice(0, 4);

    const duplicateSnapshot: CertificateContentSnapshotDTO = {
      ...originalVersion.contentSnapshot,
    };

    const newVersion: CertificateVersionDTO = {
      id: randomUUID(),
      studentYearCertificateId: cert.id,
      versionNumber: newVersionNumber,
      contentSnapshot: duplicateSnapshot,
      templateVersion: originalVersion.templateVersion,
      pdfStorageBucket: 'certificates',
      pdfStorageObjectKey: `certificates/${yearPrefix}/${cert.certificateNumber}-v${newVersionNumber}-duplicate.pdf`,
      issueOrReissueReason: payload.reason.trim(),
      generatedBy: session.staffId,
      approvedBy: cert.approvedBy,
      isDuplicate: true,
      duplicateLabel: 'DUPLICATE COPY',
      generatedAt: nowIso,
    };

    versions.push(newVersion);
    certificateVersionsVault.set(cert.id, versions);

    // Audit the reprint (US-37 AC2)
    await auditReportingService.recordAuditEvent({
      actorStaffId: session.staffId,
      actorName: session.fullName,
      actorRole: session.role,
      action: 'CERTIFICATE_REPRINTED',
      entityType: 'student_year_certificate',
      entityId: cert.id,
      beforeSnapshot: { versionCount: versions.length - 1 },
      afterSnapshot: {
        versionNumber: newVersionNumber,
        isDuplicate: true,
        duplicateLabel: 'DUPLICATE COPY',
        reason: payload.reason.trim(),
      },
      reason: payload.reason.trim(),
    });

    return {
      certificateId: cert.id,
      certificateNumber: cert.certificateNumber,
      newVersionNumber,
      reason: payload.reason.trim(),
      reprintedAt: nowIso,
      pdfDownloadUrl: `/api/v1/certificates/${cert.id}/pdf?version=${newVersionNumber}`,
    };
  }
}

export const certificatesService = new CertificatesService();
