import { randomUUID } from 'crypto';
import {
  MarkStudentStatusRequestDTO,
  MarkStudentStatusResultDTO,
  StudentAcademicRecordHistoryDTO,
  StudentProfileDTO,
  StudentSearchFilterDTO,
  StudentSearchItemDTO,
  StudentSensitiveDetailsDTO,
  StudentStatusHistoryItemDTO,
  StudentYearStatus,
} from './types';
import { AuthenticatedUserSession } from '../identity-access/types';
import {
  AuthorizationError,
  BusinessRuleError,
  NotFoundError,
  ValidationError,
} from '../../lib/errors';
import { enforcePolicy } from '../../policy/guards';
import {
  decryptSensitiveField,
  isAuthorizedForSensitivePii,
  maskAadhaar,
} from '../../lib/crypto/pii';
import { admissionsService, InternalAcademicRecord } from '../admissions/service';
import { academicYearsService } from '../academic-years/service';
import { feesLedgerService } from '../fees-ledger/service';
import { receiptsService } from '../receipts/service';
import { documentsService } from '../documents/service';
import { auditReportingService } from '../audit-reporting/service';
import { logger } from '../../lib/logger';
import { certificatesService } from '../certificates-lctc/service';
import { AdmissionNumber, toDecimalInrString } from '../shared/types';

// In-memory vault for student status history (fallback/testing)
const studentStatusHistoryVault = new Map<string, StudentStatusHistoryItemDTO[]>(); // studentAcademicRecordId -> history

export class StudentRecordsService {
  /**
   * Resets status history for testing.
   */
  resetForTesting(): void {
    studentStatusHistoryVault.clear();
  }

  /**
   * Multi-criteria student search scoped to academic years and role privacy (US-30).
   * Strictly filters sensitive PII so unauthorized staff never receive sensitive data (R-06).
   */
  async searchStudents(
    filter: StudentSearchFilterDTO,
    session: AuthenticatedUserSession
  ): Promise<{ data: StudentSearchItemDTO[]; total: number }> {
    const targetYearId = filter.academicYearId || session.activeAcademicYearId;
    const academicYears = await academicYearsService.listAcademicYears();
    const yearMap = new Map(academicYears.map((y) => [y.id, y.label]));

    // 1. Gather all academic records from admissions service
    let records = admissionsService.getAllAcademicRecords();

    // 2. Filter by academic year (if specified or defaulted)
    if (targetYearId && targetYearId !== 'all') {
      records = records.filter((r) => r.academicYearId === targetYearId);
    }

    // 3. Filter by grade level / section
    if (filter.gradeLevelId) {
      records = records.filter((r) => r.gradeLevelId === filter.gradeLevelId);
    }
    if (filter.sectionId) {
      records = records.filter((r) => r.sectionId === filter.sectionId);
    }

    // 4. Filter by status (US-30 AC3: Left/Transferred students included and clearly labelled)
    if (filter.status && filter.status !== 'all') {
      records = records.filter((r) => r.status === filter.status);
    }

    // 5. Build searchable projected items
    const items: StudentSearchItemDTO[] = [];

    for (const record of records) {
      const student = admissionsService.getStudentById(record.studentId);
      const app = admissionsService.getApplicationByRecordId(record.id);
      const grade = admissionsService.getGradeLevel(record.gradeLevelId);
      const section = admissionsService.getSection(record.sectionId);

      const fullName = student ? `${student.firstName} ${student.lastName}`.trim() : 'Unknown';
      const primaryGuardian = app?.guardians?.find((g) => g.isPrimaryContact) || app?.guardians?.[0];

      // Multi-criteria text search: name, admission number, STS number, DISE number
      if (filter.search) {
        const query = filter.search.toLowerCase().trim();
        const matchesName = fullName.toLowerCase().includes(query);
        const matchesAdm = record.admissionNumber.toLowerCase().includes(query);
        const matchesSts = student?.stsNumber?.toLowerCase().includes(query) ?? false;
        const matchesDise = student?.diseNumber?.toLowerCase().includes(query) ?? false;

        if (!matchesName && !matchesAdm && !matchesSts && !matchesDise) {
          continue;
        }
      }

      items.push({
        id: record.studentId,
        studentAcademicRecordId: record.id,
        academicYearId: record.academicYearId,
        academicYearLabel: yearMap.get(record.academicYearId) || '2026-2027',
        admissionNumber: record.admissionNumber as AdmissionNumber,
        stsNumber: student?.stsNumber || null,
        diseNumber: student?.diseNumber || null,
        fullName,
        gender: student?.gender || 'not_specified',
        dateOfBirth: student?.dateOfBirth || '',
        gradeLevelId: record.gradeLevelId,
        gradeLevelName: grade?.name || 'Standard 1',
        sectionId: record.sectionId,
        sectionName: section?.name || 'Section A',
        status: record.status,
        primaryGuardianName: primaryGuardian?.fullName || 'N/A',
        primaryGuardianMobile: primaryGuardian?.mobileNumber || 'N/A',
        transportOptedIn: record.transportOptedIn,
      });
    }

    const total = items.length;
    const offset = filter.offset ?? 0;
    const limit = filter.limit ?? 50;
    const paginated = items.slice(offset, offset + limit);

    return {
      data: paginated,
      total,
    };
  }

  /**
   * Retrieves single student profile with role-filtered tabs and PII access logging (US-31, R-06).
   */
  async getStudentProfile(
    identifier: string,
    requestedAcademicYearId: string | undefined,
    session: AuthenticatedUserSession
  ): Promise<StudentProfileDTO> {
    const academicYears = await academicYearsService.listAcademicYears();
    const yearMap = new Map(academicYears.map((y) => [y.id, y.label]));

    // Resolve academic record
    let currentRecord = admissionsService.getAcademicRecord(identifier);
    let studentId = identifier;

    if (currentRecord) {
      studentId = currentRecord.studentId;
    } else {
      // Identifier was studentId; find academic record for requested/current year
      const targetYearId = requestedAcademicYearId || session.activeAcademicYearId;
      const allRecordsForStudent = admissionsService
        .getAllAcademicRecords()
        .filter((r) => r.studentId === studentId);

      currentRecord =
        allRecordsForStudent.find((r) => r.academicYearId === targetYearId) ||
        allRecordsForStudent[0];
    }

    if (!currentRecord) {
      throw new NotFoundError(`Student profile not found for identifier "${identifier}".`);
    }

    const student = admissionsService.getStudentById(studentId);
    const app = admissionsService.getApplicationByRecordId(currentRecord.id);

    if (!student) {
      throw new NotFoundError(`Student demographic data not found for student ID "${studentId}".`);
    }

    // Academic history across all years
    const allStudentRecords = admissionsService
      .getAllAcademicRecords()
      .filter((r) => r.studentId === studentId);

    const academicHistory: StudentAcademicRecordHistoryDTO[] = allStudentRecords.map((r) => {
      const g = admissionsService.getGradeLevel(r.gradeLevelId);
      const s = admissionsService.getSection(r.sectionId);
      return {
        academicRecordId: r.id,
        academicYearId: r.academicYearId,
        academicYearLabel: yearMap.get(r.academicYearId) || '2026-2027',
        gradeLevelName: g?.name || 'Standard 1',
        sectionName: s?.name || 'Section A',
        admissionNumber: r.admissionNumber,
        admissionDate: r.admissionDate,
        status: r.status,
        rollNumber: r.rollNumber,
        transportOptedIn: r.transportOptedIn,
        notes: r.notes,
      };
    });

    const currentGrade = admissionsService.getGradeLevel(currentRecord.gradeLevelId);
    const currentSec = admissionsService.getSection(currentRecord.sectionId);

    const currentAcademicRecordDTO: StudentAcademicRecordHistoryDTO = {
      academicRecordId: currentRecord.id,
      academicYearId: currentRecord.academicYearId,
      academicYearLabel: yearMap.get(currentRecord.academicYearId) || '2026-2027',
      gradeLevelName: currentGrade?.name || 'Standard 1',
      sectionName: currentSec?.name || 'Section A',
      admissionNumber: currentRecord.admissionNumber,
      admissionDate: currentRecord.admissionDate,
      status: currentRecord.status,
      rollNumber: currentRecord.rollNumber,
      transportOptedIn: currentRecord.transportOptedIn,
      notes: currentRecord.notes,
    };

    // Sensitive details & documents (US-31 AC2, R-06):
    let sensitiveDetails: StudentSensitiveDetailsDTO | null = null;
    let documents: Array<{
      id: string;
      documentTypeCode: string;
      documentTypeName: string;
      verificationStatus: string;
      versionNumber: number;
      createdAt: string;
    }> | null = null;

    if (isAuthorizedForSensitivePii(session.role)) {
      if (app?.sensitiveDetails) {
        let unmaskedAadhaar: string | undefined;
        try {
          const encAadhaar =
            (app.sensitiveDetails as any).aadhaarNumber ||
            (app.sensitiveDetails as any).aadhaarNumberEncrypted;
          if (encAadhaar) {
            unmaskedAadhaar = decryptSensitiveField(encAadhaar);
          }
        } catch {
          // If decryption fails, keep unmasked undefined
        }

        const sd = app.sensitiveDetails as any;
        const lastFour =
          sd.aadhaarLastFour ||
          sd.aadhaarNumberLastFour ||
          (unmaskedAadhaar ? unmaskedAadhaar.slice(-4) : '');

        sensitiveDetails = {
          studentId,
          aadhaarNumberMasked: maskAadhaar(lastFour),
          aadhaarNumberUnmasked: unmaskedAadhaar,
          householdIncomeInr: sd.annualFamilyIncome || sd.householdIncomeInr || null,
          casteCategory: sd.caste || sd.casteCategory || null,
          subCaste: sd.subCaste || null,
          religion: sd.religion || app.student.religion || null,
          motherTongue: sd.motherTongue || null,
        };
      }

      // Fetch uploaded documents
      const docs = await documentsService.listDocumentsForStudent(studentId, session);
      documents = docs.map((d) => ({
        id: d.id,
        documentTypeCode: d.documentTypeCode,
        documentTypeName: d.documentTypeCode,
        verificationStatus: d.verificationStatus,
        versionNumber: d.versionNumber,
        createdAt: d.uploadedAt,
      }));

      // Log sensitive PII access audit event
      await auditReportingService.recordAuditEvent({
        actorStaffId: session.staffId,
        actorName: session.fullName,
        actorRole: session.role,
        action: 'SENSITIVE_PII_VIEWED',
        entityType: 'student',
        entityId: studentId,
        reason: 'Authorized profile viewing by Principal/Admission Officer',
      });
    }

    // Fees summary (accessible to roles with fees:view_dues)
    let feeSummary = null;
    let receipts = null;
    try {
      feeSummary = await feesLedgerService.getStudentDues(currentRecord.id, session);
      receipts = await receiptsService.listReceiptsForStudent(currentRecord.id, session);
    } catch {
      // Role not authorized or fee assessment not generated
    }

    // Certificates summary
    const studentCertificates = await certificatesService.listCertificatesForRecord(
      currentRecord.id
    );

    // Status transitions history
    const statusHistory = studentStatusHistoryVault.get(currentRecord.id) || [];

    return {
      studentId,
      demographics: student,
      guardians: app?.guardians || [],
      currentAcademicRecord: currentAcademicRecordDTO,
      academicHistory,
      statusHistory,
      sensitiveDetails,
      documents,
      feeSummary,
      receipts,
      certificates: studentCertificates,
    };
  }

  /**
   * Principal-authorized transition to mark a student as Left / Transferred / Withdrawn (US-32, BR-30).
   * Validates mandatory exit date and reason. Frees student's seat while preserving all records permanently.
   */
  async markStudentStatus(
    identifier: string,
    payload: MarkStudentStatusRequestDTO,
    session: AuthenticatedUserSession
  ): Promise<MarkStudentStatusResultDTO> {
    // 1. Role enforcement: Principal strictly has institutional authority for Left/Transferred status
    enforcePolicy(session.role, 'students:mark_left');

    // 2. Validate input fields
    if (!payload.academicRecordId) {
      throw new ValidationError('academicRecordId is required.');
    }
    if (!payload.newStatus || !['left', 'transferred', 'withdrawn'].includes(payload.newStatus)) {
      throw new ValidationError('newStatus must be one of: "left", "transferred", "withdrawn".');
    }
    if (!payload.exitDate || !/^\d{4}-\d{2}-\d{2}$/.test(payload.exitDate)) {
      throw new ValidationError('exitDate is mandatory and must follow format YYYY-MM-DD.');
    }
    if (!payload.exitReason || payload.exitReason.trim().length < 3) {
      throw new ValidationError('exitReason is mandatory and must be at least 3 characters.');
    }

    // 3. Find academic record
    const record = admissionsService.getAcademicRecord(payload.academicRecordId);
    if (!record) {
      throw new NotFoundError(
        `Student academic record with ID "${payload.academicRecordId}" was not found.`
      );
    }

    // 4. Closed academic year check (SBR-05)
    await academicYearsService.assertYearIsNotClosed(record.academicYearId);

    // 5. Invariant check: student must be in active or admitted status
    if (record.status !== 'admitted' && record.status !== 'active') {
      throw new BusinessRuleError(
        `Cannot change status: Student is currently "${record.status}". Status change to "${payload.newStatus}" is only allowed from "admitted" or "active".`
      );
    }

    const previousStatus = record.status;
    const nowIso = new Date().toISOString();

    // 6. Mutate status (seat is automatically freed because capacity queries exclude left/transferred/withdrawn)
    record.status = payload.newStatus;

    // 7. Record status transition history
    const historyItem: StudentStatusHistoryItemDTO = {
      id: randomUUID(),
      academicRecordId: record.id,
      previousStatus,
      newStatus: payload.newStatus,
      effectiveDate: payload.exitDate,
      reason: payload.exitReason.trim(),
      changedByStaffId: session.staffId,
      changedByStaffName: session.fullName,
      createdAt: nowIso,
    };

    const existingHistory = studentStatusHistoryVault.get(record.id) || [];
    existingHistory.push(historyItem);
    studentStatusHistoryVault.set(record.id, existingHistory);

    // 8. Immutable audit event
    await auditReportingService.recordAuditEvent({
      actorStaffId: session.staffId,
      actorName: session.fullName,
      actorRole: session.role,
      action: 'STUDENT_STATUS_CHANGED',
      entityType: 'student_academic_record',
      entityId: record.id,
      beforeSnapshot: { status: previousStatus },
      afterSnapshot: {
        status: payload.newStatus,
        exitDate: payload.exitDate,
        exitReason: payload.exitReason.trim(),
      },
      reason: payload.exitReason.trim(),
    });

    logger.info(`Student status transitioned to ${payload.newStatus}`, {
      studentId: record.studentId,
      academicRecordId: record.id,
      previousStatus,
      newStatus: payload.newStatus,
      exitDate: payload.exitDate,
      actorStaffId: session.staffId,
    });

    return {
      academicRecordId: record.id,
      studentId: record.studentId,
      previousStatus,
      newStatus: payload.newStatus,
      exitDate: payload.exitDate,
      exitReason: payload.exitReason.trim(),
      updatedBy: session.staffId,
      updatedAt: nowIso,
    };
  }

  /**
   * Prevents physical hard delete (US-33 AC1).
   */
  async deleteStudent(): Promise<never> {
    throw new BusinessRuleError('Zero deletion policy: Student records cannot be deleted.');
  }
}

export const studentRecordsService = new StudentRecordsService();
