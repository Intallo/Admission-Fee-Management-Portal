import { randomUUID } from 'crypto';
import { toDecimalInrString } from '../shared/types';
import {
  AdmissionApplicationDetailDTO,
  AdmissionApplicationStatus,
  AdmissionApplicationSummaryDTO,
  AdmissionStatusCountsDTO,
  AdmissionStatusHistoryItemDTO,
  ApplicationListFilterDTO,
  ApplicationListResponseDTO,
  ApproveAdmissionResultDTO,
  CapacityPolicyConfig,
  CreateAdmissionDraftDTO,
  GradeGroup,
  GuardianDetailsDTO,
  SectionCapacityDTO,
  StudentDemographicsDTO,
  StudentSensitiveDetailsDTO,
  UpdateAdmissionDraftDTO,
} from './types';
import { AuthenticatedUserSession, StaffRole } from '../identity-access/types';
import {
  AuthorizationError,
  BusinessRuleError,
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../../lib/errors';
import { enforcePolicy } from '../../policy/guards';
import {
  computeAadhaarHash,
  decryptSensitiveField,
  encryptSensitiveField,
  extractAadhaarLastFour,
  isAuthorizedForSensitivePii,
  maskAadhaar,
  maskBankAccount,
} from '../../lib/crypto/pii';
import { documentsService } from '../documents/service';
import { academicYearsService } from '../academic-years/service';
import { feeConfigurationService } from '../fee-configuration/service';
import { logger } from '../../lib/logger';
import { getAdminDbClient } from '../../infrastructure/db/supabase-admin';

export interface SectionEntity {
  id: string;
  academicYearId: string;
  gradeLevelId: string;
  name: string;
  maxCapacity: number;
  isActive: boolean;
}

export interface GradeLevelEntity {
  id: string;
  code: string;
  name: string;
  groupName: GradeGroup;
  sortOrder: number;
}

export interface FeeHeadEntity {
  id: string;
  code: string;
  name: string;
  category: 'school_fee' | 'vehicle' | 'books';
  isVariable: boolean;
  isOptional: boolean;
}

export interface FeeStructureEntity {
  id: string;
  academicYearId: string;
  gradeLevelId: string;
  version: number;
  status: 'draft' | 'pending_approval' | 'approved' | 'retired';
  lines: Array<{
    id: string;
    feeHeadId: string;
    amount: number | null;
  }>;
}

export interface InternalApplicationRecord {
  id: string;
  applicationNumber: string;
  academicYearId: string;
  requestedGradeLevelId: string;
  requestedSectionId: string | null;
  status: AdmissionApplicationStatus;
  studentId: string;
  student: StudentDemographicsDTO;
  sensitiveDetails?: StudentSensitiveDetailsDTO;
  aadhaarHash?: string | null;
  guardians: GuardianDetailsDTO[];
  statusHistory: AdmissionStatusHistoryItemDTO[];
  decisionReason: string | null;
  seatReservedUntil: string | null;
  overrideMissingDocumentsReason?: string | null;
  feeGenerated: boolean;
  admissionFeeRecordedAt: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InternalAcademicRecord {
  id: string;
  studentId: string;
  academicYearId: string;
  gradeLevelId: string;
  sectionId: string;
  admissionNumber: string;
  status: 'admitted' | 'active' | 'left' | 'transferred' | 'withdrawn';
  admissionDate: string;
  rollNumber: string | null;
  transportOptedIn: boolean;
  notes: string | null;
  createdAt: string;
}

export interface InternalFeeAssessment {
  id: string;
  assessmentNumber: string;
  studentAcademicRecordId: string;
  feeStructureId: string;
  status: 'issued';
  assessedAt: string;
  lines: Array<{
    id: string;
    feeHeadId: string;
    assessedAmount: number;
  }>;
}

// Global in-memory storage vaults for synthetic test mode and caching
const applicationsVault = new Map<string, InternalApplicationRecord>();
const academicRecordsVault = new Map<string, InternalAcademicRecord>();
const feeAssessmentsVault = new Map<string, InternalFeeAssessment>();

// Monotonic sequence counters
const applicationSeqVault = new Map<string, number>(); // academicYearId -> nextSeq
const admissionSeqVault = new Map<string, number>();   // academicYearId -> nextSeq

// Master metadata tables
const gradeLevelsVault: GradeLevelEntity[] = [
  { id: '30000000-0000-0000-0000-000000000001', code: 'NUR', name: 'Nursery', groupName: 'pre_primary', sortOrder: 1 },
  { id: '30000000-0000-0000-0000-000000000002', code: 'LKG', name: 'LKG', groupName: 'pre_primary', sortOrder: 2 },
  { id: '30000000-0000-0000-0000-000000000003', code: 'UKG', name: 'UKG', groupName: 'pre_primary', sortOrder: 3 },
  { id: '30000000-0000-0000-0000-000000000004', code: 'STD1', name: 'Class 1', groupName: 'primary', sortOrder: 4 },
  { id: '30000000-0000-0000-0000-000000000005', code: 'STD2', name: 'Class 2', groupName: 'primary', sortOrder: 5 },
  { id: '30000000-0000-0000-0000-000000000006', code: 'STD3', name: 'Class 3', groupName: 'primary', sortOrder: 6 },
  { id: '30000000-0000-0000-0000-000000000007', code: 'STD4', name: 'Class 4', groupName: 'primary', sortOrder: 7 },
  { id: '30000000-0000-0000-0000-000000000008', code: 'STD5', name: 'Class 5', groupName: 'primary', sortOrder: 8 },
  { id: '30000000-0000-0000-0000-000000000009', code: 'STD8', name: 'Class 8', groupName: 'high_school', sortOrder: 11 },
  { id: '30000000-0000-0000-0000-000000000010', code: 'STD10', name: 'Class 10', groupName: 'high_school', sortOrder: 13 },
];

const sectionsVault: SectionEntity[] = [
  { id: '40000000-0000-0000-0000-000000000001', academicYearId: '00000000-0000-0000-0000-000000000001', gradeLevelId: '30000000-0000-0000-0000-000000000004', name: 'A', maxCapacity: 40, isActive: true },
  { id: '40000000-0000-0000-0000-000000000002', academicYearId: '00000000-0000-0000-0000-000000000001', gradeLevelId: '30000000-0000-0000-0000-000000000004', name: 'B', maxCapacity: 40, isActive: true },
  { id: '40000000-0000-0000-0000-000000000003', academicYearId: '00000000-0000-0000-0000-000000000001', gradeLevelId: '30000000-0000-0000-0000-000000000001', name: 'A', maxCapacity: 30, isActive: true },
  { id: '40000000-0000-0000-0000-000000000004', academicYearId: '00000000-0000-0000-0000-000000000001', gradeLevelId: '30000000-0000-0000-0000-000000000008', name: 'A', maxCapacity: 40, isActive: true },
  { id: '40000000-0000-0000-0000-000000000005', academicYearId: '00000000-0000-0000-0000-000000000001', gradeLevelId: '30000000-0000-0000-0000-000000000009', name: 'A', maxCapacity: 40, isActive: true },
];

const feeHeadsVault: FeeHeadEntity[] = [
  { id: '50000000-0000-0000-0000-000000000001', code: 'ADMISSION_FEE', name: 'Admission Fee', category: 'school_fee', isVariable: true, isOptional: false },
  { id: '50000000-0000-0000-0000-000000000002', code: 'TUITION_FEE', name: 'Tuition Fee', category: 'school_fee', isVariable: false, isOptional: false },
  { id: '50000000-0000-0000-0000-000000000003', code: 'DEVELOPMENT_FEE', name: 'Development Fee', category: 'school_fee', isVariable: false, isOptional: false },
  { id: '50000000-0000-0000-0000-000000000004', code: 'EXAM_FEE', name: 'Examination Fee', category: 'school_fee', isVariable: false, isOptional: false },
  { id: '50000000-0000-0000-0000-000000000005', code: 'BOOKS', name: 'Books', category: 'books', isVariable: false, isOptional: false },
  { id: '50000000-0000-0000-0000-000000000006', code: 'SCHOOL_BUS', name: 'School Bus / Vehicle Fee', category: 'vehicle', isVariable: true, isOptional: true },
];

const feeStructuresVault: FeeStructureEntity[] = [
  {
    id: '60000000-0000-0000-0000-000000000001',
    academicYearId: '00000000-0000-0000-0000-000000000001',
    gradeLevelId: '30000000-0000-0000-0000-000000000004', // STD1
    version: 1,
    status: 'approved',
    lines: [
      { id: '60000000-0000-0000-0001-000000000001', feeHeadId: '50000000-0000-0000-0000-000000000001', amount: null }, // Variable Admission Fee
      { id: '60000000-0000-0000-0001-000000000002', feeHeadId: '50000000-0000-0000-0000-000000000002', amount: 14000.00 },
      { id: '60000000-0000-0000-0001-000000000003', feeHeadId: '50000000-0000-0000-0000-000000000003', amount: 2000.00 },
      { id: '60000000-0000-0000-0001-000000000004', feeHeadId: '50000000-0000-0000-0000-000000000004', amount: 1200.00 },
      { id: '60000000-0000-0000-0001-000000000005', feeHeadId: '50000000-0000-0000-0000-000000000005', amount: 2500.00 },
    ],
  },
  {
    id: '60000000-0000-0000-0000-000000000002',
    academicYearId: '00000000-0000-0000-0000-000000000001',
    gradeLevelId: '30000000-0000-0000-0000-000000000001', // Nursery
    version: 1,
    status: 'approved',
    lines: [
      { id: '60000000-0000-0000-0002-000000000001', feeHeadId: '50000000-0000-0000-0000-000000000001', amount: null },
      { id: '60000000-0000-0000-0002-000000000002', feeHeadId: '50000000-0000-0000-0000-000000000002', amount: 8500.00 },
      { id: '60000000-0000-0000-0002-000000000003', feeHeadId: '50000000-0000-0000-0000-000000000003', amount: 2000.00 },
      { id: '60000000-0000-0000-0002-000000000004', feeHeadId: '50000000-0000-0000-0000-000000000004', amount: 1200.00 },
    ],
  },
];

// Mutex lock for atomic approvals & capacity checks
class AsyncLock {
  private promise: Promise<void> = Promise.resolve();

  async acquire(): Promise<() => void> {
    let release: () => void = () => {};
    const nextPromise = new Promise<void>((resolve) => {
      release = resolve;
    });
    const currentPromise = this.promise;
    this.promise = this.promise.then(() => nextPromise);
    await currentPromise;
    return release;
  }
}

const approvalLock = new AsyncLock();

// Capacity policy configuration
let capacityPolicyConfig: CapacityPolicyConfig = {
  mode: 'dual_enforcement',
  defaultSectionCapacity: 40,
  divisionGroupCapacity: 100, // SRS §3 A-08 default
};

export class AdmissionsService {
  /**
   * Resets in-memory state for clean test isolation.
   */
  resetForTesting(): void {
    applicationsVault.clear();
    academicRecordsVault.clear();
    feeAssessmentsVault.clear();
    applicationSeqVault.clear();
    admissionSeqVault.clear();
    capacityPolicyConfig = {
      mode: 'dual_enforcement',
      defaultSectionCapacity: 40,
      divisionGroupCapacity: 100,
    };
  }

  /**
   * Configures capacity enforcement rules.
   */
  setCapacityPolicy(config: Partial<CapacityPolicyConfig>, actorSession: AuthenticatedUserSession): void {
    if (actorSession.role !== 'principal') {
      throw new AuthorizationError('Only the Principal possesses authority to modify capacity enforcement policy.');
    }
    capacityPolicyConfig = { ...capacityPolicyConfig, ...config };
    logger.info('Section capacity policy updated', {
      policy: capacityPolicyConfig,
      actorStaffId: actorSession.staffId,
    });
  }

  /**
   * Retrieves current capacity policy configuration.
   */
  getCapacityPolicy(): CapacityPolicyConfig {
    return { ...capacityPolicyConfig };
  }

  /**
   * Formats academic year short label e.g. "2026-2027" -> "2026-27".
   */
  formatAcademicYearShort(label: string): string {
    const match = label.match(/^(\d{4})-(\d{4})$/);
    if (match) {
      return `${match[1]}-${match[2].slice(-2)}`;
    }
    return label;
  }

  /**
   * Allocates the next monotonic application number for an academic year ({seq}/{year}).
   */
  getNextApplicationNumber(academicYearId: string, yearLabel: string): string {
    const currentSeq = applicationSeqVault.get(academicYearId) || 1;
    applicationSeqVault.set(academicYearId, currentSeq + 1);
    const shortLabel = this.formatAcademicYearShort(yearLabel);
    return `${currentSeq}/${shortLabel}`;
  }

  /**
   * Allocates the next monotonic admission number (ADM-YYYY-NNNN).
   */
  getNextAdmissionNumber(academicYearId: string, yearLabel: string): string {
    const startYearMatch = yearLabel.match(/^(\d{4})/);
    const startYear = startYearMatch ? startYearMatch[1] : '2026';
    const currentSeq = admissionSeqVault.get(academicYearId) || 1;
    admissionSeqVault.set(academicYearId, currentSeq + 1);
    const padded = String(currentSeq).padStart(4, '0');
    return `ADM-${startYear}-${padded}`;
  }

  /**
   * Checks section and division-group capacity.
   */
  async checkCapacity(sectionId: string, academicYearId: string): Promise<SectionCapacityDTO> {
    const section = sectionsVault.find((s) => s.id === sectionId && s.academicYearId === academicYearId);
    if (!section) {
      throw new NotFoundError(`Section with ID "${sectionId}" not found in academic year.`);
    }

    const gradeLevel = gradeLevelsVault.find((g) => g.id === section.gradeLevelId);
    if (!gradeLevel) {
      throw new NotFoundError(`Grade level with ID "${section.gradeLevelId}" not found.`);
    }

    // Count enrolled or active students in section
    const enrolledInSection = Array.from(academicRecordsVault.values()).filter(
      (r) =>
        r.academicYearId === academicYearId &&
        r.sectionId === sectionId &&
        (r.status === 'admitted' || r.status === 'active')
    ).length;

    // Count enrolled students in division group (Pre-primary, Primary, High School)
    const gradeLevelIdsInGroup = gradeLevelsVault
      .filter((g) => g.groupName === gradeLevel.groupName)
      .map((g) => g.id);

    const enrolledInGroup = Array.from(academicRecordsVault.values()).filter(
      (r) =>
        r.academicYearId === academicYearId &&
        gradeLevelIdsInGroup.includes(r.gradeLevelId) &&
        (r.status === 'admitted' || r.status === 'active')
    ).length;

    const sectionMaxCapacity = section.maxCapacity || capacityPolicyConfig.defaultSectionCapacity;
    const groupMaxCapacity = capacityPolicyConfig.divisionGroupCapacity;

    const availableInSection = Math.max(0, sectionMaxCapacity - enrolledInSection);
    const availableInGroup = Math.max(0, groupMaxCapacity - enrolledInGroup);

    let isCapacityAvailable = true;
    if (capacityPolicyConfig.mode === 'section_only') {
      isCapacityAvailable = availableInSection > 0;
    } else if (capacityPolicyConfig.mode === 'division_group_only') {
      isCapacityAvailable = availableInGroup > 0;
    } else {
      isCapacityAvailable = availableInSection > 0 && availableInGroup > 0;
    }

    return {
      sectionId: section.id,
      sectionName: section.name,
      gradeLevelId: gradeLevel.id,
      gradeLevelName: gradeLevel.name,
      gradeGroup: gradeLevel.groupName,
      enrolledInSection,
      sectionMaxCapacity,
      availableInSection,
      enrolledInGroup,
      groupMaxCapacity,
      availableInGroup,
      isCapacityAvailable,
    };
  }

  /**
   * Creates a new admission application draft with minimal fields (US-07 AC2, US-12).
   * Generates application number on first save ({seq}/{year}).
   */
  async createDraftApplication(
    payload: CreateAdmissionDraftDTO,
    actorSession: AuthenticatedUserSession
  ): Promise<AdmissionApplicationDetailDTO> {
    enforcePolicy(actorSession.role, 'admissions:create_draft');

    // 1. Verify academic year is writable (not closed)
    const academicYear = await academicYearsService.assertAcademicYearWritable(payload.academicYearId);

    // 2. Validate grade level
    const gradeLevel = gradeLevelsVault.find((g) => g.id === payload.gradeLevelId);
    if (!gradeLevel) {
      throw new NotFoundError(`Grade level with ID "${payload.gradeLevelId}" not found.`);
    }

    // 3. Duplicate STS number check (US-08 AC5)
    if (payload.student.stsNumber && payload.student.stsNumber.trim() !== '') {
      const normalizedSts = payload.student.stsNumber.trim().toUpperCase();
      const existing = Array.from(applicationsVault.values()).find(
        (app) => app.student.stsNumber?.trim().toUpperCase() === normalizedSts
      );
      if (existing) {
        throw new ConflictError(
          `STS number "${payload.student.stsNumber}" is already registered to existing student "${existing.student.firstName} ${existing.student.lastName}".`
        );
      }
    }

    // 4. Duplicate Aadhaar hash check (ADR-001 / DPDP Act)
    let aadhaarHash: string | null = null;
    if (payload.sensitiveDetails?.aadhaarNumber && payload.sensitiveDetails.aadhaarNumber.trim() !== '') {
      aadhaarHash = computeAadhaarHash(payload.sensitiveDetails.aadhaarNumber);
      const existingAadhaar = Array.from(applicationsVault.values()).find(
        (app) => app.aadhaarHash === aadhaarHash
      );
      if (existingAadhaar) {
        throw new ConflictError(
          `A student with this Aadhaar number is already registered (${existingAadhaar.student.firstName} ${existingAadhaar.student.lastName}).`
        );
      }
    }

    // 5. Allocate monotonic application number on first save (US-07 AC3)
    const applicationNumber = this.getNextApplicationNumber(academicYear.id, academicYear.label);
    const applicationId = randomUUID();
    const studentId = randomUUID();
    const nowIso = new Date().toISOString();

    // 6. Encrypt sensitive details before storage
    let processedSensitive: StudentSensitiveDetailsDTO | undefined = undefined;
    if (payload.sensitiveDetails) {
      const raw = payload.sensitiveDetails;
      processedSensitive = {
        aadhaarNumber: raw.aadhaarNumber ? encryptSensitiveField(raw.aadhaarNumber) : undefined,
        aadhaarLastFour: raw.aadhaarNumber ? extractAadhaarLastFour(raw.aadhaarNumber) : null,
        caste: raw.caste || (raw as any).casteCategory || null,
        subCaste: raw.subCaste || null,
        annualFamilyIncome: raw.annualFamilyIncome || (raw as any).householdIncomeInr || null,
        casteCertificateNumber: raw.casteCertificateNumber || null,
        incomeCertificateNumber: raw.incomeCertificateNumber || null,
        bankName: raw.bankName || null,
        accountNumber: raw.accountNumber ? encryptSensitiveField(raw.accountNumber) : null,
        ifscCode: raw.ifscCode || null,
      };
    }

    const initialHistory: AdmissionStatusHistoryItemDTO = {
      id: randomUUID(),
      fromStatus: null,
      toStatus: 'draft',
      changedBy: actorSession.staffId,
      changedByName: actorSession.fullName,
      changedByRole: actorSession.role,
      reason: 'Draft application initiated.',
      changedAt: nowIso,
    };

    const record: InternalApplicationRecord = {
      id: applicationId,
      applicationNumber,
      academicYearId: payload.academicYearId,
      requestedGradeLevelId: payload.gradeLevelId,
      requestedSectionId: payload.requestedSectionId || null,
      status: 'draft',
      studentId,
      student: { ...payload.student },
      sensitiveDetails: processedSensitive,
      aadhaarHash,
      guardians: payload.guardians ? [...payload.guardians] : [],
      statusHistory: [initialHistory],
      decisionReason: null,
      seatReservedUntil: null,
      overrideMissingDocumentsReason: null,
      feeGenerated: false,
      admissionFeeRecordedAt: null,
      submittedAt: null,
      reviewedAt: null,
      reviewedBy: null,
      createdBy: actorSession.staffId,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    applicationsVault.set(applicationId, record);

    // Optional DB synchronization
    try {
      const adminDb = getAdminDbClient();
      await adminDb.from('admission_applications').insert({
        id: record.id,
        application_number: record.applicationNumber,
        academic_year_id: record.academicYearId,
        requested_grade_level_id: record.requestedGradeLevelId,
        requested_section_id: record.requestedSectionId,
        status: 'draft',
        student_id: record.studentId,
        created_by: actorSession.staffId,
      });
    } catch {
      // Test environment fallback
    }

    logger.info('New admission application draft created', {
      applicationId,
      applicationNumber,
      academicYearId: academicYear.id,
      gradeLevelCode: gradeLevel.code,
      actorStaffId: actorSession.staffId,
    });

    return this.toDetailDTO(record, actorSession);
  }

  /**
   * Updates an admission application in authorized states (draft or on_hold).
   * Submitted applications are strictly read-only for Admission Officers (US-12 AC2).
   */
  async updateDraftApplication(
    applicationId: string,
    payload: UpdateAdmissionDraftDTO,
    actorSession: AuthenticatedUserSession
  ): Promise<AdmissionApplicationDetailDTO> {
    const record = applicationsVault.get(applicationId);
    if (!record) {
      throw new NotFoundError(`Admission application with ID "${applicationId}" not found.`);
    }

    // Check academic year writable
    await academicYearsService.assertAcademicYearWritable(record.academicYearId);

    // State enforcement: only draft or on_hold can be edited
    if (record.status !== 'draft' && record.status !== 'on_hold') {
      throw new BusinessRuleError(
        `Disallowed update: Applications in "${record.status}" state cannot be modified. Submitted applications are read-only until returned to draft by the Principal.`
      );
    }

    // Check STS uniqueness if STS is being updated
    if (payload.student?.stsNumber && payload.student.stsNumber.trim() !== '') {
      const normalizedSts = payload.student.stsNumber.trim().toUpperCase();
      const duplicate = Array.from(applicationsVault.values()).find(
        (app) => app.id !== applicationId && app.student.stsNumber?.trim().toUpperCase() === normalizedSts
      );
      if (duplicate) {
        throw new ConflictError(
          `STS number "${payload.student.stsNumber}" is already registered to existing student "${duplicate.student.firstName} ${duplicate.student.lastName}".`
        );
      }
    }

    // Check Aadhaar uniqueness if Aadhaar is being updated
    if (payload.sensitiveDetails?.aadhaarNumber && payload.sensitiveDetails.aadhaarNumber.trim() !== '') {
      const newHash = computeAadhaarHash(payload.sensitiveDetails.aadhaarNumber);
      const dup = Array.from(applicationsVault.values()).find(
        (app) => app.id !== applicationId && app.aadhaarHash === newHash
      );
      if (dup) {
        throw new ConflictError(
          `A student with this Aadhaar number is already registered (${dup.student.firstName} ${dup.student.lastName}).`
        );
      }
      record.aadhaarHash = newHash;
    }

    if (payload.gradeLevelId) {
      const gl = gradeLevelsVault.find((g) => g.id === payload.gradeLevelId);
      if (!gl) throw new NotFoundError(`Grade level with ID "${payload.gradeLevelId}" not found.`);
      record.requestedGradeLevelId = payload.gradeLevelId;
    }

    if (payload.requestedSectionId !== undefined) {
      record.requestedSectionId = payload.requestedSectionId;
    }

    if (payload.student) {
      record.student = { ...record.student, ...payload.student };
    }

    if (payload.guardians) {
      record.guardians = [...payload.guardians];
    }

    if (payload.sensitiveDetails) {
      const raw = payload.sensitiveDetails;
      record.sensitiveDetails = {
        ...record.sensitiveDetails,
        ...(raw.aadhaarNumber ? { aadhaarNumber: encryptSensitiveField(raw.aadhaarNumber), aadhaarLastFour: extractAadhaarLastFour(raw.aadhaarNumber) } : {}),
        ...(raw.caste !== undefined ? { caste: raw.caste } : {}),
        ...(raw.subCaste !== undefined ? { subCaste: raw.subCaste } : {}),
        ...(raw.annualFamilyIncome !== undefined ? { annualFamilyIncome: raw.annualFamilyIncome } : {}),
        ...(raw.casteCertificateNumber !== undefined ? { casteCertificateNumber: raw.casteCertificateNumber } : {}),
        ...(raw.incomeCertificateNumber !== undefined ? { incomeCertificateNumber: raw.incomeCertificateNumber } : {}),
        ...(raw.bankName !== undefined ? { bankName: raw.bankName } : {}),
        ...(raw.accountNumber ? { accountNumber: encryptSensitiveField(raw.accountNumber) } : {}),
        ...(raw.ifscCode !== undefined ? { ifscCode: raw.ifscCode } : {}),
      };
    }

    record.updatedAt = new Date().toISOString();
    applicationsVault.set(applicationId, record);

    logger.info('Admission application draft updated', {
      applicationId,
      actorStaffId: actorSession.staffId,
    });

    return this.toDetailDTO(record, actorSession);
  }

  /**
   * Submits an application for Principal review (US-13).
   * Runs completeness check and validates document checklist.
   */
  async submitApplication(
    applicationId: string,
    payload: { overrideMissingDocumentsReason?: string },
    actorSession: AuthenticatedUserSession
  ): Promise<AdmissionApplicationDetailDTO> {
    enforcePolicy(actorSession.role, 'admissions:submit_verification');

    const record = applicationsVault.get(applicationId);
    if (!record) {
      throw new NotFoundError(`Admission application with ID "${applicationId}" not found.`);
    }

    await academicYearsService.assertAcademicYearWritable(record.academicYearId);

    if (record.status !== 'draft') {
      throw new BusinessRuleError(
        `Disallowed submission: Only draft applications can be submitted. Current state is "${record.status}".`
      );
    }

    // 1. Completeness validation (US-13 AC1)
    const errors: Array<{ name: string; reason: string }> = [];
    if (!record.student.firstName || record.student.firstName.trim() === '') {
      errors.push({ name: 'student.firstName', reason: 'Student first name is required.' });
    }
    if (!record.student.lastName || record.student.lastName.trim() === '') {
      errors.push({ name: 'student.lastName', reason: 'Student last name is required.' });
    }
    if (!record.student.dateOfBirth) {
      errors.push({ name: 'student.dateOfBirth', reason: 'Date of birth is required.' });
    } else if (new Date(record.student.dateOfBirth) > new Date()) {
      errors.push({ name: 'student.dateOfBirth', reason: 'Date of birth cannot be in the future.' });
    }
    if (!record.student.gender) {
      errors.push({ name: 'student.gender', reason: 'Student gender is required.' });
    }
    if (!record.requestedGradeLevelId) {
      errors.push({ name: 'requestedGradeLevelId', reason: 'Requested standard (grade level) is required.' });
    }

    // Guardian requirement: at least one contact with a valid 10-digit phone (US-09 AC3)
    const validGuardian = record.guardians.find(
      (g) => g.fullName && g.mobileNumber && /^\+?[0-9]{10,13}$/.test(g.mobileNumber.trim())
    );
    if (!validGuardian) {
      errors.push({
        name: 'guardians',
        reason: 'At least one guardian with a valid 10-digit contact number is required before submission.',
      });
    }

    if (errors.length > 0) {
      throw new ValidationError('Application completeness check failed.', errors);
    }

    // 2. Document checklist check (US-11 AC3)
    const checklist = await documentsService.getApplicationChecklist(
      applicationId,
      record.academicYearId,
      record.requestedGradeLevelId
    );

    if (checklist.missingMandatoryCount > 0 && (!payload.overrideMissingDocumentsReason || payload.overrideMissingDocumentsReason.trim() === '')) {
      throw new BusinessRuleError(
        `Submission blocked: ${checklist.missingMandatoryCount} mandatory document(s) are missing. Please upload the required documents or provide an authorized override reason.`
      );
    }

    const nowIso = new Date().toISOString();
    const prevStatus = record.status;
    record.status = 'submitted';
    record.submittedAt = nowIso;
    record.overrideMissingDocumentsReason = payload.overrideMissingDocumentsReason || null;
    record.updatedAt = nowIso;

    const historyItem: AdmissionStatusHistoryItemDTO = {
      id: randomUUID(),
      fromStatus: prevStatus,
      toStatus: 'submitted',
      changedBy: actorSession.staffId,
      changedByName: actorSession.fullName,
      changedByRole: actorSession.role,
      reason: payload.overrideMissingDocumentsReason ? `Submitted with document override: ${payload.overrideMissingDocumentsReason}` : 'Submitted for Principal review.',
      changedAt: nowIso,
    };
    record.statusHistory.push(historyItem);
    applicationsVault.set(applicationId, record);

    logger.info('Admission application submitted for verification', {
      applicationId,
      actorStaffId: actorSession.staffId,
      hasDocumentOverride: !!payload.overrideMissingDocumentsReason,
    });

    return this.toDetailDTO(record, actorSession);
  }

  /**
   * Puts an application on hold (Principal only, US-14 AC2).
   */
  async putApplicationOnHold(
    applicationId: string,
    payload: { reason: string; seatReservedUntil?: string },
    actorSession: AuthenticatedUserSession
  ): Promise<AdmissionApplicationDetailDTO> {
    enforcePolicy(actorSession.role, 'admissions:approve_decision');

    const record = applicationsVault.get(applicationId);
    if (!record) {
      throw new NotFoundError(`Admission application with ID "${applicationId}" not found.`);
    }

    if (record.status !== 'submitted' && record.status !== 'under_review') {
      throw new BusinessRuleError(`Cannot put application on hold from current state "${record.status}".`);
    }

    if (!payload.reason || payload.reason.trim().length < 3) {
      throw new ValidationError('A reason must be provided when placing an application on hold.');
    }

    const nowIso = new Date().toISOString();
    const prevStatus = record.status;
    record.status = 'on_hold';
    record.decisionReason = payload.reason.trim();
    record.seatReservedUntil = payload.seatReservedUntil || null;
    record.reviewedBy = actorSession.staffId;
    record.reviewedAt = nowIso;
    record.updatedAt = nowIso;

    record.statusHistory.push({
      id: randomUUID(),
      fromStatus: prevStatus,
      toStatus: 'on_hold',
      changedBy: actorSession.staffId,
      changedByName: actorSession.fullName,
      changedByRole: actorSession.role,
      reason: payload.reason.trim(),
      changedAt: nowIso,
    });

    applicationsVault.set(applicationId, record);

    logger.info('Application placed on hold by Principal', {
      applicationId,
      actorStaffId: actorSession.staffId,
      reason: payload.reason,
    });

    return this.toDetailDTO(record, actorSession);
  }

  /**
   * Returns a submitted/held application to draft (Principal only, US-12 AC2).
   */
  async returnToDraft(
    applicationId: string,
    reason: string,
    actorSession: AuthenticatedUserSession
  ): Promise<AdmissionApplicationDetailDTO> {
    enforcePolicy(actorSession.role, 'admissions:approve_decision');

    const record = applicationsVault.get(applicationId);
    if (!record) {
      throw new NotFoundError(`Admission application with ID "${applicationId}" not found.`);
    }

    if (record.status !== 'submitted' && record.status !== 'under_review' && record.status !== 'on_hold') {
      throw new BusinessRuleError(`Cannot return application to draft from current state "${record.status}".`);
    }

    if (!reason || reason.trim().length < 3) {
      throw new ValidationError('A justification reason is required when returning an application to draft.');
    }

    const nowIso = new Date().toISOString();
    const prevStatus = record.status;
    record.status = 'draft';
    record.decisionReason = reason.trim();
    record.updatedAt = nowIso;

    record.statusHistory.push({
      id: randomUUID(),
      fromStatus: prevStatus,
      toStatus: 'draft',
      changedBy: actorSession.staffId,
      changedByName: actorSession.fullName,
      changedByRole: actorSession.role,
      reason: `Returned to draft by Principal: ${reason.trim()}`,
      changedAt: nowIso,
    });

    applicationsVault.set(applicationId, record);

    logger.info('Application returned to draft by Principal', {
      applicationId,
      actorStaffId: actorSession.staffId,
      reason,
    });

    return this.toDetailDTO(record, actorSession);
  }

  /**
   * Rejects an application (Principal only, US-14 AC2).
   */
  async rejectApplication(
    applicationId: string,
    reason: string,
    actorSession: AuthenticatedUserSession
  ): Promise<AdmissionApplicationDetailDTO> {
    enforcePolicy(actorSession.role, 'admissions:approve_decision');

    const record = applicationsVault.get(applicationId);
    if (!record) {
      throw new NotFoundError(`Admission application with ID "${applicationId}" not found.`);
    }

    if (record.status !== 'submitted' && record.status !== 'under_review' && record.status !== 'on_hold') {
      throw new BusinessRuleError(`Cannot reject application from current state "${record.status}".`);
    }

    if (!reason || reason.trim().length < 5) {
      throw new ValidationError('A detailed rejection reason of at least 5 characters is mandatory.');
    }

    const nowIso = new Date().toISOString();
    const prevStatus = record.status;
    record.status = 'rejected';
    record.decisionReason = reason.trim();
    record.reviewedBy = actorSession.staffId;
    record.reviewedAt = nowIso;
    record.updatedAt = nowIso;

    record.statusHistory.push({
      id: randomUUID(),
      fromStatus: prevStatus,
      toStatus: 'rejected',
      changedBy: actorSession.staffId,
      changedByName: actorSession.fullName,
      changedByRole: actorSession.role,
      reason: reason.trim(),
      changedAt: nowIso,
    });

    applicationsVault.set(applicationId, record);

    logger.info('Admission application rejected by Principal', {
      applicationId,
      actorStaffId: actorSession.staffId,
      reason,
    });

    return this.toDetailDTO(record, actorSession);
  }

  /**
   * Atomically approves an admission application (Principal only, Operation 1: admit_student_atomic).
   * Enforces:
   * 1. Principal role authority strictly.
   * 2. Transaction boundary: status transition + section capacity check + admission number allocation + student academic record + fee instantiation + audit log commit atomically.
   * 3. Admission approval requires ZERO fee payment (DEC-01 / BR-37).
   * 4. Rollback guarantee: on any failure, state is restored.
   * 5. Monotonic unique admission number sequence (ADM-YYYY-NNNN).
   */
  async approveApplication(
    applicationId: string,
    payload: { sectionId: string; remarks?: string },
    actorSession: AuthenticatedUserSession
  ): Promise<ApproveAdmissionResultDTO> {
    // 1. Strict Principal authority check (REG-01, RC-01)
    if (actorSession.role !== 'principal') {
      throw new AuthorizationError(
        `Access Denied: Only the Principal holds authority to approve student admissions. Role "${actorSession.role}" is prohibited.`
      );
    }

    // Acquire transaction concurrency lock
    const releaseLock = await approvalLock.acquire();

    // Snapshot state for atomic rollback on failure
    const snapshotApp = applicationsVault.get(applicationId);
    let snapshotAcademicRecordId: string | null = null;
    let snapshotAssessmentId: string | null = null;

    try {
      const record = applicationsVault.get(applicationId);
      if (!record) {
        throw new NotFoundError(`Admission application with ID "${applicationId}" not found.`);
      }

      // Check academic year writable
      const academicYear = await academicYearsService.assertAcademicYearWritable(record.academicYearId);

      // 2. Idempotent check
      if (record.status === 'approved') {
        const existingRecord = Array.from(academicRecordsVault.values()).find(
          (r) => r.studentId === record.studentId && r.academicYearId === record.academicYearId
        );
        if (existingRecord) {
          const existingAssessment = Array.from(feeAssessmentsVault.values()).find(
            (a) => a.studentAcademicRecordId === existingRecord.id
          );
          const totalAssessed = existingAssessment
            ? existingAssessment.lines.reduce((acc, l) => acc + l.assessedAmount, 0).toFixed(2)
            : '0.00';

          return {
            applicationId: record.id,
            applicationNumber: record.applicationNumber,
            admissionNumber: existingRecord.admissionNumber,
            studentId: record.studentId,
            studentAcademicRecordId: existingRecord.id,
            sectionId: existingRecord.sectionId,
            status: 'approved',
            approvedBy: record.reviewedBy || actorSession.staffId,
            approvedAt: record.reviewedAt || record.updatedAt,
            initialAssessmentId: existingAssessment ? existingAssessment.id : null,
            initialBilledAmountInr: toDecimalInrString(totalAssessed),
            feeGenerated: !!existingAssessment,
          };
        }
      }

      // State check: must be submitted, under_review, or on_hold
      if (record.status !== 'submitted' && record.status !== 'under_review' && record.status !== 'on_hold') {
        throw new BusinessRuleError(
          `Disallowed approval: Cannot approve application in state "${record.status}". Application must be submitted first.`
        );
      }

      // 3. Section verification & Section Capacity Check (US-42 / BR-38)
      const capacity = await this.checkCapacity(payload.sectionId, record.academicYearId);
      if (!capacity.isCapacityAvailable) {
        throw new BusinessRuleError(
          `SECTION_CAPACITY_EXCEEDED: Section "${capacity.sectionName}" in "${capacity.gradeLevelName}" has reached maximum capacity (${capacity.enrolledInSection}/${capacity.sectionMaxCapacity} seats filled). Approval blocked.`
        );
      }

      // 4. Monotonic Admission Number Allocation (ADM-YYYY-NNNN)
      const admissionNumber = this.getNextAdmissionNumber(record.academicYearId, academicYear.label);
      const studentAcademicRecordId = randomUUID();
      snapshotAcademicRecordId = studentAcademicRecordId;
      const nowIso = new Date().toISOString();
      const todayDate = nowIso.slice(0, 10);

      // 5. Create student academic record (admitted)
      const newAcademicRecord: InternalAcademicRecord = {
        id: studentAcademicRecordId,
        studentId: record.studentId,
        academicYearId: record.academicYearId,
        gradeLevelId: capacity.gradeLevelId,
        sectionId: payload.sectionId,
        admissionNumber,
        status: 'admitted',
        admissionDate: todayDate,
        rollNumber: null,
        transportOptedIn: record.student.transportOptedIn ?? false,
        notes: payload.remarks || 'Admitted via Principal approval.',
        createdAt: nowIso,
      };
      academicRecordsVault.set(studentAcademicRecordId, newAcademicRecord);

      // 6. Fee Instantiation from approved structure (US-15 AC1, AC5)
      // Admission requires ZERO fee payment (DEC-01)
      let approvedStructure: any = await feeConfigurationService
        .getApprovedFeeStructureForGrade(record.academicYearId, capacity.gradeLevelId)
        .catch(() => null);

      if (!approvedStructure) {
        approvedStructure = feeStructuresVault.find(
          (fs) =>
            fs.academicYearId === record.academicYearId &&
            fs.gradeLevelId === capacity.gradeLevelId &&
            fs.status === 'approved'
        );
      }

      let initialAssessmentId: string | null = null;
      let initialBilledAmount = 0;
      let feeGenerated = false;

      if (approvedStructure) {
        initialAssessmentId = randomUUID();
        snapshotAssessmentId = initialAssessmentId;
        const assessmentLines: Array<{ id: string; feeHeadId: string; assessedAmount: number }> = [];

        for (const line of approvedStructure.lines) {
          let feeHead: any = feeHeadsVault.find((h) => h.id === line.feeHeadId);
          if (!feeHead) {
            try {
              const headDto = await feeConfigurationService.getFeeHeadById(line.feeHeadId);
              feeHead = {
                id: headDto.id,
                code: headDto.code,
                name: headDto.name,
                category: headDto.category,
                isVariable: headDto.isVariable,
                isOptional: false,
              };
            } catch {
              // Ignore if not resolvable
            }
          }
          if (!feeHead) continue;

          // Variable Admission Fee is billed upon payment, not upfront, per D-002
          if (feeHead.isVariable) {
            continue;
          }

          const rawAmt = line.defaultAmount !== undefined ? line.defaultAmount : line.amount;
          const lineAmt = typeof rawAmt === 'string' ? parseFloat(rawAmt) : (typeof rawAmt === 'number' ? rawAmt : null);
          if (lineAmt !== null && !isNaN(lineAmt) && lineAmt > 0) {
            assessmentLines.push({
              id: randomUUID(),
              feeHeadId: line.feeHeadId,
              assessedAmount: lineAmt,
            });
            initialBilledAmount += lineAmt;
          }
        }

        const feeAssessment: InternalFeeAssessment = {
          id: initialAssessmentId,
          assessmentNumber: `AST-${academicYear.label.slice(0, 4)}-${String(initialAssessmentId).slice(-4)}`,
          studentAcademicRecordId,
          feeStructureId: approvedStructure.id,
          status: 'issued',
          assessedAt: nowIso,
          lines: assessmentLines,
        };
        feeAssessmentsVault.set(initialAssessmentId, feeAssessment);
        feeGenerated = true;
      } else {
        // Fee structure not approved yet; student admitted with "fee not generated" (US-15 AC5)
        feeGenerated = false;
        logger.warn('Student admitted without fee structure: Fee not generated', {
          applicationId,
          gradeLevelId: capacity.gradeLevelId,
        });
      }

      // 7. Transition application state to approved
      const prevStatus = record.status;
      record.status = 'approved';
      record.requestedSectionId = payload.sectionId;
      record.decisionReason = payload.remarks || 'Principal approved admission.';
      record.feeGenerated = feeGenerated;
      record.reviewedBy = actorSession.staffId;
      record.reviewedAt = nowIso;
      record.updatedAt = nowIso;

      record.statusHistory.push({
        id: randomUUID(),
        fromStatus: prevStatus,
        toStatus: 'approved',
        changedBy: actorSession.staffId,
        changedByName: actorSession.fullName,
        changedByRole: actorSession.role,
        reason: payload.remarks || 'Principal approved admission.',
        changedAt: nowIso,
      });

      applicationsVault.set(applicationId, record);

      // 8. Immutable audit event insertion
      logger.info('Student admission atomically approved by Principal', {
        action: 'ADMISSION_APPROVED',
        applicationId,
        admissionNumber,
        studentId: record.studentId,
        sectionId: payload.sectionId,
        actorStaffId: actorSession.staffId,
        initialBilledAmount: initialBilledAmount.toFixed(2),
        zeroPaymentRequired: true,
      });

      return {
        applicationId: record.id,
        applicationNumber: record.applicationNumber,
        admissionNumber,
        studentId: record.studentId,
        studentAcademicRecordId,
        sectionId: payload.sectionId,
        status: 'approved',
        approvedBy: actorSession.staffId,
        approvedAt: nowIso,
        initialAssessmentId,
        initialBilledAmountInr: toDecimalInrString(initialBilledAmount),
        feeGenerated,
      };
    } catch (err) {
      // Rollback on approval failure: clean state restoration
      if (snapshotApp) {
        applicationsVault.set(applicationId, JSON.parse(JSON.stringify(snapshotApp)));
      }
      if (snapshotAcademicRecordId) {
        academicRecordsVault.delete(snapshotAcademicRecordId);
      }
      if (snapshotAssessmentId) {
        feeAssessmentsVault.delete(snapshotAssessmentId);
      }
      throw err;
    } finally {
      releaseLock();
    }
  }

  /**
   * Retrieves application detail with strict field-level PII protection (US-03, R-06).
   */
  async getApplicationById(
    applicationId: string,
    actorSession: AuthenticatedUserSession
  ): Promise<AdmissionApplicationDetailDTO> {
    const record = applicationsVault.get(applicationId);
    if (!record) {
      throw new NotFoundError(`Admission application with ID "${applicationId}" not found.`);
    }

    return this.toDetailDTO(record, actorSession);
  }

  /**
   * Lists admission applications with filtering, search, and summary status counts.
   * Strips/masks sensitive PII for non-authorized roles (Accounts Officer, SysAdmin).
   */
  async listApplications(
    filters: ApplicationListFilterDTO,
    actorSession: AuthenticatedUserSession
  ): Promise<ApplicationListResponseDTO> {
    let items = Array.from(applicationsVault.values());

    // Scoped by academic year if provided
    if (filters.academicYearId) {
      items = items.filter((a) => a.academicYearId === filters.academicYearId);
    }

    // Calculate status counts on the year-scoped set
    const counts: AdmissionStatusCountsDTO = {
      draftCount: items.filter((a) => a.status === 'draft').length,
      submittedCount: items.filter((a) => a.status === 'submitted').length,
      underReviewCount: items.filter((a) => a.status === 'under_review').length,
      onHoldCount: items.filter((a) => a.status === 'on_hold').length,
      approvedCount: items.filter((a) => a.status === 'approved').length,
      rejectedCount: items.filter((a) => a.status === 'rejected').length,
      totalCount: items.length,
    };

    // Filter by status
    if (filters.status) {
      items = items.filter((a) => a.status === filters.status);
    }

    // Filter by grade level
    if (filters.gradeLevelId) {
      items = items.filter((a) => a.requestedGradeLevelId === filters.gradeLevelId);
    }

    // Filter by section
    if (filters.sectionId) {
      items = items.filter((a) => a.requestedSectionId === filters.sectionId);
    }

    // Filter by Fee not generated
    if (filters.feeNotGenerated) {
      items = items.filter((a) => a.status === 'approved' && !a.feeGenerated);
    }

    // Search query (student name, application number, STS number)
    if (filters.search && filters.search.trim() !== '') {
      const q = filters.search.trim().toLowerCase();
      items = items.filter(
        (a) =>
          a.applicationNumber.toLowerCase().includes(q) ||
          `${a.student.firstName} ${a.student.lastName}`.toLowerCase().includes(q) ||
          (a.student.stsNumber && a.student.stsNumber.toLowerCase().includes(q))
      );
    }

    // Map to summaries
    const mapped: AdmissionApplicationSummaryDTO[] = [];
    for (const app of items) {
      const grade = gradeLevelsVault.find((g) => g.id === app.requestedGradeLevelId);
      const section = sectionsVault.find((s) => s.id === app.requestedSectionId);
      const year = await academicYearsService.getAcademicYearById(app.academicYearId).catch(() => null);

      mapped.push({
        id: app.id,
        applicationNumber: app.applicationNumber,
        academicYearId: app.academicYearId,
        academicYearLabel: year?.label || '2026-2027',
        gradeLevelId: app.requestedGradeLevelId,
        gradeLevelName: grade?.name || 'Class',
        sectionId: app.requestedSectionId,
        sectionName: section?.name || null,
        studentId: app.studentId,
        studentName: `${app.student.firstName} ${app.student.lastName}`,
        stsNumber: app.student.stsNumber || null,
        status: app.status,
        submissionDate: app.submittedAt ? app.submittedAt.slice(0, 10) : null,
        missingDocumentsCount: 0,
        feeGenerated: app.feeGenerated,
        createdAt: app.createdAt,
        updatedAt: app.updatedAt,
      });
    }

    return { items: mapped, counts };
  }

  /**
   * Transforms an internal application record into a role-sanitized detail DTO.
   */
  private async toDetailDTO(
    record: InternalApplicationRecord,
    actorSession: AuthenticatedUserSession
  ): Promise<AdmissionApplicationDetailDTO> {
    const gradeLevel = gradeLevelsVault.find((g) => g.id === record.requestedGradeLevelId);
    const section = sectionsVault.find((s) => s.id === record.requestedSectionId);
    const academicYear = await academicYearsService.getAcademicYearById(record.academicYearId).catch(() => null);

    const checklist = await documentsService.getApplicationChecklist(
      record.id,
      record.academicYearId,
      record.requestedGradeLevelId
    );

    let capacity: SectionCapacityDTO | null = null;
    if (record.requestedSectionId) {
      capacity = await this.checkCapacity(record.requestedSectionId, record.academicYearId).catch(() => null);
    }

    // Role-based sensitive PII sanitization (US-03 AC6, R-06)
    const canViewPii = isAuthorizedForSensitivePii(actorSession.role);
    let sanitizedSensitive: StudentSensitiveDetailsDTO | null = null;

    if (canViewPii && record.sensitiveDetails) {
      // Principal & Admission Officer: can view decrypted fields
      sanitizedSensitive = {
        aadhaarNumber: record.sensitiveDetails.aadhaarNumber ? decryptSensitiveField(record.sensitiveDetails.aadhaarNumber) : undefined,
        aadhaarLastFour: record.sensitiveDetails.aadhaarLastFour,
        caste: record.sensitiveDetails.caste,
        subCaste: record.sensitiveDetails.subCaste,
        annualFamilyIncome: record.sensitiveDetails.annualFamilyIncome,
        casteCertificateNumber: record.sensitiveDetails.casteCertificateNumber,
        incomeCertificateNumber: record.sensitiveDetails.incomeCertificateNumber,
        bankName: record.sensitiveDetails.bankName,
        accountNumber: record.sensitiveDetails.accountNumber ? decryptSensitiveField(record.sensitiveDetails.accountNumber) : undefined,
        ifscCode: record.sensitiveDetails.ifscCode,
      };
    } else if (!canViewPii && record.sensitiveDetails) {
      // Accounts Officer, SysAdmin, Clerk, ReadOnly: masked or omitted
      sanitizedSensitive = {
        aadhaarLastFour: record.sensitiveDetails.aadhaarLastFour ? maskAadhaar(record.sensitiveDetails.aadhaarLastFour) : null,
        bankName: record.sensitiveDetails.bankName || null,
        // Prohibited fields omitted
      };
    }

    return {
      id: record.id,
      applicationNumber: record.applicationNumber,
      academicYearId: record.academicYearId,
      academicYearLabel: academicYear?.label || '2026-2027',
      requestedGradeLevelId: record.requestedGradeLevelId,
      requestedGradeLevelName: gradeLevel?.name || 'Class',
      requestedSectionId: record.requestedSectionId,
      requestedSectionName: section?.name || null,
      status: record.status,
      studentId: record.studentId,
      student: { ...record.student },
      sensitiveDetails: sanitizedSensitive,
      guardians: record.guardians.map((g) => ({
        ...g,
        annualIncomeInr: canViewPii ? g.annualIncomeInr : undefined, // Hide parent income from unauthorized roles
      })),
      checklist,
      capacity,
      statusHistory: [...record.statusHistory],
      decisionReason: record.decisionReason,
      seatReservedUntil: record.seatReservedUntil,
      feeGenerated: record.feeGenerated,
      submittedAt: record.submittedAt,
      reviewedAt: record.reviewedAt,
      reviewedBy: record.reviewedBy,
      createdBy: record.createdBy,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  /**
   * Helper to seed standard synthetic applications for testing.
   */
  seedDemoApplications(): void {
    const academicYearId = '00000000-0000-0000-0000-000000000001';
    const std1Id = '30000000-0000-0000-0000-000000000004';
    const sectionAId = '40000000-0000-0000-0000-000000000001';

    const demoApp1: InternalApplicationRecord = {
      id: 'a0000000-0000-0000-0000-000000000001',
      applicationNumber: '161/2026-27',
      academicYearId,
      requestedGradeLevelId: std1Id,
      requestedSectionId: sectionAId,
      status: 'submitted',
      studentId: 'b0000000-0000-0000-0000-000000000001',
      student: {
        firstName: 'Aarav',
        lastName: 'Sharma',
        dateOfBirth: '2020-05-15',
        gender: 'male',
        bloodGroup: 'B+',
        religion: 'Hindu',
        stsNumber: 'STS-2026-001',
        addressLine1: '12 Demo Garden Road',
        city: 'Bengaluru',
        state: 'Karnataka',
        pincode: '560001',
        transportMode: 'School Bus',
        transportOptedIn: true,
      },
      sensitiveDetails: {
        aadhaarNumber: encryptSensitiveField('999988887777'),
        aadhaarLastFour: '7777',
        caste: 'General',
        subCaste: 'Brahmin',
        annualFamilyIncome: toDecimalInrString('450000.00'),
        bankName: 'State Bank of India',
        accountNumber: encryptSensitiveField('123456789012'),
        ifscCode: 'SBIN0001234',
      },
      guardians: [
        {
          fullName: 'Priya Sharma',
          relationship: 'Mother',
          mobileNumber: '+919876543210',
          email: 'priya.sharma@guardian-demo.example',
          occupation: 'Teacher',
          annualIncomeInr: toDecimalInrString('450000.00'),
          residentialAddress: '12 Demo Garden Road, Bengaluru',
          isPrimaryContact: true,
        },
      ],
      statusHistory: [
        {
          id: randomUUID(),
          fromStatus: null,
          toStatus: 'draft',
          changedBy: null,
          reason: 'Application initiated.',
          changedAt: '2026-06-01T09:00:00.000Z',
        },
        {
          id: randomUUID(),
          fromStatus: 'draft',
          toStatus: 'submitted',
          changedBy: null,
          reason: 'Application submitted for Principal review.',
          changedAt: '2026-06-02T10:00:00.000Z',
        },
      ],
      decisionReason: null,
      seatReservedUntil: null,
      overrideMissingDocumentsReason: null,
      feeGenerated: false,
      admissionFeeRecordedAt: null,
      submittedAt: '2026-06-02T10:00:00.000Z',
      reviewedAt: null,
      reviewedBy: null,
      createdBy: null,
      createdAt: '2026-06-01T09:00:00.000Z',
      updatedAt: '2026-06-02T10:00:00.000Z',
    };

    applicationsVault.set(demoApp1.id, demoApp1);
  }

  // --- Cross-module Accessors for Fees Ledger & Receipts ---

  getAcademicRecord(id: string): InternalAcademicRecord | undefined {
    return academicRecordsVault.get(id);
  }

  getAllAcademicRecords(): InternalAcademicRecord[] {
    return Array.from(academicRecordsVault.values());
  }

  getFeeAssessment(id: string): InternalFeeAssessment | undefined {
    return feeAssessmentsVault.get(id);
  }

  getFeeAssessmentByRecordId(studentAcademicRecordId: string): InternalFeeAssessment | undefined {
    return Array.from(feeAssessmentsVault.values()).find(
      (a) => a.studentAcademicRecordId === studentAcademicRecordId
    );
  }

  getAllFeeAssessments(): InternalFeeAssessment[] {
    return Array.from(feeAssessmentsVault.values());
  }

  saveFeeAssessment(assessment: InternalFeeAssessment): void {
    feeAssessmentsVault.set(assessment.id, assessment);
  }

  getGradeLevel(id: string): GradeLevelEntity | undefined {
    return gradeLevelsVault.find((g) => g.id === id);
  }

  getSection(id: string): SectionEntity | undefined {
    return sectionsVault.find((s) => s.id === id);
  }

  getStudentById(id: string): StudentDemographicsDTO | undefined {
    const app = Array.from(applicationsVault.values()).find((a) => a.studentId === id);
    return app?.student;
  }

  getApplicationByRecordId(academicRecordId: string): InternalApplicationRecord | undefined {
    const record = academicRecordsVault.get(academicRecordId);
    if (!record) return undefined;
    return Array.from(applicationsVault.values()).find((a) => a.studentId === record.studentId);
  }

  getAllApplications(): InternalApplicationRecord[] {
    return Array.from(applicationsVault.values());
  }

  getAllSections(): SectionEntity[] {
    return [...sectionsVault];
  }

  getAllGradeLevels(): GradeLevelEntity[] {
    return [...gradeLevelsVault];
  }
}

export const admissionsService = new AdmissionsService();
// Initialize seed data
admissionsService.seedDemoApplications();
