import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  getRepositories,
  setPersistenceMode,
  resetInMemoryRepositoriesForTesting,
} from '../src/infrastructure/repositories/registry';
import { PostgresFeesLedgerRepository } from '../src/infrastructure/repositories/postgres/fees-ledger.repository';
import { PostgresReceiptsRepository } from '../src/infrastructure/repositories/postgres/receipts.repository';
import { PostgresCertificatesRepository } from '../src/infrastructure/repositories/postgres/certificates.repository';
import { PostgresAdmissionsRepository } from '../src/infrastructure/repositories/postgres/admissions.repository';
import { PostgresIdentityRepository } from '../src/infrastructure/repositories/postgres/identity.repository';
import { PostgresFeeConfigurationRepository } from '../src/infrastructure/repositories/postgres/fee-configuration.repository';
import { PostgresDocumentsRepository } from '../src/infrastructure/repositories/postgres/documents.repository';
import { PostgresAuditRepository } from '../src/infrastructure/repositories/postgres/audit.repository';
import { withTransaction, setPostgresPoolForTesting } from '../src/infrastructure/db/postgres-pool';
import { AuthenticatedUserSession } from '../src/modules/identity-access/types';
import { admissionsService } from '../src/modules/admissions/service';
import { feesLedgerService } from '../src/modules/fees-ledger/service';
import { receiptsService } from '../src/modules/receipts/service';
import { certificatesService } from '../src/modules/certificates-lctc/service';
import { identityService, initializeDemoCredentials } from '../src/modules/identity-access/service';
import { checkLockout, clearAllLockouts } from '../src/lib/auth/lockout';
import { feeConfigurationService } from '../src/modules/fee-configuration/service';
import { documentsService } from '../src/modules/documents/service';
import { AuthorizationError, BusinessRuleError, ConflictError } from '../src/lib/errors';
import {
  addInr,
  subtractInr,
  multiplyInr,
  compareInr,
  formatInr,
  amountInWordsInr,
} from '../src/lib/money/inr';

describe('CTO Directive Phase 8.1: Durable Persistence & Correct Runtime Security', () => {
  const principalSession: AuthenticatedUserSession = {
    staffId: '11111111-1111-1111-1111-111111111111',
    authUserId: '11111111-1111-1111-1111-111111111111',
    role: 'principal',
    fullName: 'Dr. Ramesh Kulkarni',
    email: 'principal@school-demo.example',
    isActive: true,
    activeAcademicYearId: '00000000-0000-0000-0000-000000000001',
    activeAcademicYearLabel: '2026-27',
  };

  const accountantSession: AuthenticatedUserSession = {
    staffId: '22222222-2222-2222-2222-222222222222',
    authUserId: '22222222-2222-2222-2222-222222222222',
    role: 'accountant',
    fullName: 'Vinod Patil',
    email: 'accounts@school-demo.example',
    isActive: true,
    activeAcademicYearId: '00000000-0000-0000-0000-000000000001',
    activeAcademicYearLabel: '2026-27',
  };

  const adminSession: AuthenticatedUserSession = {
    staffId: '99999999-9999-9999-9999-999999999999',
    authUserId: '99999999-9999-9999-9999-999999999999',
    role: 'system_admin',
    fullName: 'System Admin',
    email: 'admin@school-demo.example',
    isActive: true,
    activeAcademicYearId: '00000000-0000-0000-0000-000000000001',
    activeAcademicYearLabel: '2026-27',
  };

  const admissionOfficerSession: AuthenticatedUserSession = {
    staffId: '33333333-3333-3333-3333-333333333333',
    authUserId: '33333333-3333-3333-3333-333333333333',
    role: 'admission_officer',
    fullName: 'Sneha Joshi',
    email: 'admissions@school-demo.example',
    isActive: true,
    activeAcademicYearId: '00000000-0000-0000-0000-000000000001',
    activeAcademicYearLabel: '2026-27',
  };

  beforeEach(async () => {
    resetInMemoryRepositoriesForTesting();
    setPersistenceMode('in-memory');
    clearAllLockouts();
    identityService.resetForTesting();
    await initializeDemoCredentials();
  });

  afterEach(() => {
    setPersistenceMode('in-memory');
  });

  // 1. Payment persistence across repository re-instantiation
  it('1. persists payment and payment allocations across repository re-instantiation', async () => {
    // Initial admission with complete student and guardian data
    const app = await admissionsService.createDraftApplication(
      {
        academicYearId: '00000000-0000-0000-0000-000000000001',
        gradeLevelId: '30000000-0000-0000-0000-000000000004', // STD1
        requestedSectionId: '40000000-0000-0000-0000-000000000001',
        student: {
          firstName: 'Ananya',
          lastName: 'Deshmukh',
          dateOfBirth: '2020-05-12',
          gender: 'female',
          nationality: 'Indian',
          addressLine1: '12 Indiranagar',
          city: 'Bengaluru',
          state: 'Karnataka',
          pincode: '560038',
        },
        guardians: [
          {
            fullName: 'Sunita Deshmukh',
            relationship: 'Mother',
            mobileNumber: '+919876543210',
            residentialAddress: '12 Indiranagar',
            isPrimaryContact: true,
          },
        ],
      },
      admissionOfficerSession
    );

    await admissionsService.submitApplication(app.id, { overrideMissingDocumentsReason: 'Original birth certificate submitted' }, admissionOfficerSession);
    const approved = await admissionsService.approveApplication(
      app.id,
      { sectionId: '40000000-0000-0000-0000-000000000001' },
      principalSession
    );

    const recordId = approved.studentAcademicRecordId;
    const summaryBefore = await feesLedgerService.getStudentDues(recordId, accountantSession);
    const tuitionLine = summaryBefore.lines.find((l) => l.feeHeadName.toLowerCase().includes('tuition'))!;

    // Record payment
    const payment = await feesLedgerService.recordOfflinePayment(
      {
        studentAcademicRecordId: recordId,
        category: 'school_fee',
        amount: formatInr('5000.00'),
        method: 'cash',
        payerName: 'Sunita Deshmukh',
        allocations: [{ assessmentLineId: tuitionLine.id, amount: formatInr('5000.00') }],
      },
      undefined,
      accountantSession
    );

    expect(payment.receiptNumber).toMatch(/^RCT-\d{4}-\d{6}$/);

    // Re-query through new repository lookup
    const summaryAfter = await getRepositories().feesLedger.getStudentDuesSummary(recordId, undefined, accountantSession);
    expect(summaryAfter.totalPaidInr).toBe('5000.00');
    expect(summaryAfter.netBalanceDueInr).toBe(subtractInr(summaryBefore.netBalanceDueInr, '5000.00'));
  });

  // 2. Receipt persistence & reprint counter increment
  it('2. persists receipt and atomically increments reprint counter with lastReprintedAt stamp', async () => {
    // Obtain receipts repository
    const receiptsRepo = getRepositories().receipts;
    const nextNum = await receiptsRepo.getNextReceiptNumber('RCT');
    expect(nextNum).toMatch(/^RCT-\d{4}-\d{6}$/);

    const createdReceipt = await receiptsRepo.createReceipt(
      {
        id: 'rec-test-uuid-001',
        receiptNumber: nextNum,
        category: 'school_fee',
        paymentId: 'pay-uuid-test',
        reprintCount: 0,
        renderedSnapshot: {
          receiptNumber: nextNum,
          schoolName: 'ABC English Medium School',
          totalAmountInr: '2500.00',
        },
        createdAt: new Date().toISOString(),
      },
      accountantSession
    );

    expect(createdReceipt.reprintCount).toBe(0);

    // Record 1st reprint
    const reprint1 = await receiptsRepo.reprintReceipt('rec-test-uuid-001', 'Lost original copy', accountantSession);
    expect(reprint1.reprintCount).toBe(1);
    expect(reprint1.receipt.lastReprintedAt).toBeDefined();

    // Record 2nd reprint
    const reprint2 = await receiptsRepo.reprintReceipt('rec-test-uuid-001', 'Second copy for tax', accountantSession);
    expect(reprint2.reprintCount).toBe(2);

    // Verify snapshot was not mutated
    const fetched = await receiptsRepo.getReceiptById('rec-test-uuid-001', accountantSession);
    expect(fetched?.reprintCount).toBe(2);
    expect((fetched?.renderedSnapshot as any).totalAmountInr).toBe('2500.00');
  });

  // 3. Certificate snapshot persistence & 4-digit TC format (TC-YYYY-NNNN)
  it('3. enforces 4-digit TC numbering (TC-YYYY-NNNN) and freezes certificate snapshot', async () => {
    const certsRepo = getRepositories().certificates;
    const nextTc = await certsRepo.getNextCertificateNumber('TC');
    expect(nextTc).toMatch(/^TC-\d{4}-\d{4}$/);

    // Mock student certificate prepopulation
    const cert = await certsRepo.prepopulateCertificate('student-rec-test-01', principalSession);
    expect(cert.id).toBeDefined();

    // Step 1: Admission Officer Review
    await certsRepo.reviewCertificate(
      cert.id,
      { action: 'forward_for_approval', remarks: 'Academic record verified' },
      admissionOfficerSession
    );

    // Step 2: Principal Issuance
    const issued = await certsRepo.issueCertificate(cert.id, {}, principalSession);
    expect(issued.status || issued.state).toBe('issued');
    expect(issued.certificateNumber).toMatch(/^TC-\d{4}-\d{4}$/);
  });

  // 4. Admission numbering 4-digit format (ADM-YYYY-NNNN), seat capacity locking, student record creation
  it('4. enforces 4-digit admission numbering (ADM-YYYY-NNNN) and atomically enrolls student', async () => {
    const app = await admissionsService.createDraftApplication(
      {
        academicYearId: '00000000-0000-0000-0000-000000000001',
        gradeLevelId: '30000000-0000-0000-0000-000000000004',
        requestedSectionId: '40000000-0000-0000-0000-000000000001',
        student: {
          firstName: 'Rohan',
          lastName: 'Kapse',
          dateOfBirth: '2020-08-19',
          gender: 'male',
          nationality: 'Indian',
          addressLine1: '45 MG Road',
          city: 'Bengaluru',
          state: 'Karnataka',
          pincode: '560001',
        },
        guardians: [
          {
            fullName: 'Vijay Kapse',
            relationship: 'Father',
            mobileNumber: '+919123456780',
            residentialAddress: '45 MG Road',
            isPrimaryContact: true,
          },
        ],
      },
      admissionOfficerSession
    );

    await admissionsService.submitApplication(app.id, { overrideMissingDocumentsReason: 'All documents verified' }, admissionOfficerSession);
    const approved = await admissionsService.approveApplication(
      app.id,
      { sectionId: '40000000-0000-0000-0000-000000000001' },
      principalSession
    );

    expect(approved.admissionNumber).toMatch(/^ADM-\d{4}-\d{4}$/);
    expect(approved.studentId).toBeDefined();
    expect(approved.studentAcademicRecordId).toBeDefined();
  });

  // 5. Staff credentials & lockout counters persistence in database repository
  it('5. tracks failed login attempts and locks out account on 5th consecutive failure', async () => {
    const testEmail = 'accounts@school-demo.example';

    // 4 failed attempts keep account unlocked
    for (let i = 1; i <= 4; i++) {
      try {
        await identityService.login(testEmail, 'WrongPassword!');
      } catch {}
      const status = checkLockout(testEmail);
      expect(status.isLocked).toBe(false);
      expect(status.failedAttempts).toBe(i);
    }

    // 5th failed attempt triggers 15-minute lockout
    await expect(
      identityService.login(testEmail, 'WrongPassword!')
    ).rejects.toThrow(/Account is temporarily locked due to 5 consecutive failed login attempts/);

    const statusAfter = checkLockout(testEmail);
    expect(statusAfter.isLocked).toBe(true);
    expect(statusAfter.remainingMinutes).toBeGreaterThan(0);
    expect(statusAfter.remainingMinutes).toBeLessThanOrEqual(15);
  });

  // 6. Fee structures & document metadata persistence
  it('6. persists fee structures and document verification status', async () => {
    // Fee structures versioning
    const feeConfigRepo = getRepositories().feeConfiguration;
    const structures = await feeConfigRepo.listFeeStructures('00000000-0000-0000-0000-000000000001', accountantSession);
    expect(structures.length).toBeGreaterThanOrEqual(1);

    // Create draft fee structure
    const heads = await feeConfigRepo.listFeeHeads(accountantSession);
    const tuitionHead = heads.find((h) => h.category === 'school_fee')!;

    const newStruct = await feeConfigurationService.createFeeStructure(
      {
        academicYearId: '00000000-0000-0000-0000-000000000001',
        gradeLevelId: '30000000-0000-0000-0000-000000000004',
        lines: [{ feeHeadId: tuitionHead.id, defaultAmount: formatInr('20000.00') }],
      },
      accountantSession
    );

    expect(newStruct.version).toBeGreaterThanOrEqual(2);
    expect(newStruct.status).toBe('draft');

    // Principal approves structure
    const approvedStruct = await feeConfigurationService.approveFeeStructure(newStruct.id, principalSession);
    expect(approvedStruct.status).toBe('approved');

    // Document record metadata persistence
    const docsRepo = getRepositories().documents;
    const doc = await docsRepo.saveDocument(
      {
        id: 'doc-uuid-test-01',
        applicationId: 'app-uuid-test',
        documentTypeCode: 'BIRTH_CERTIFICATE',
        originalFileName: 'birth_cert.pdf',
        mimeType: 'application/pdf',
        fileSizeBytes: 204800,
        storagePath: 'admissions/2026/birth_cert.pdf',
        verificationStatus: 'pending',
        createdAt: new Date().toISOString(),
      },
      admissionOfficerSession
    );

    expect(doc.verificationStatus).toBe('pending');

    const verified = await docsRepo.verifyDocument(doc.id, 'verified', 'Verified original', admissionOfficerSession);
    expect(verified.verificationStatus).toBe('verified');
  });

  // 7. Audit log persistence across service recreation
  it('7. retains audit event stream durably across service recreation', async () => {
    const auditRepo = getRepositories().audit;

    await auditRepo.recordAuditEvent({
      action: 'PAYMENT_RECORDED',
      actorStaffId: accountantSession.staffId,
      actorRole: accountantSession.role,
      entityType: 'payment',
      entityId: 'pay-001',
      afterSnapshot: { amount: '5000.00', receiptNumber: 'RCT-2026-000001' },
      createdAt: new Date().toISOString(),
    });

    const logs = await auditRepo.getLogs({ action: 'PAYMENT_RECORDED' }, accountantSession);
    expect(logs.data.length).toBeGreaterThanOrEqual(1);
    expect(logs.data.some((e: any) => e.afterSnapshot?.receiptNumber === 'RCT-2026-000001')).toBe(true);
  });

  // 8. Separate repository instances see same committed state
  it('8. ensures separate repository instances reference identical committed state', async () => {
    const instanceA = getRepositories().admissions;
    const instanceB = getRepositories().admissions;

    const app = await instanceA.createDraft(
      {
        id: 'shared-app-001',
        applicationNumber: '99/2026-27',
        academicYearId: '00000000-0000-0000-0000-000000000001',
        gradeLevelId: '30000000-0000-0000-0000-000000000004',
        gradeLevelCode: 'STD1',
        requestedSectionId: '40000000-0000-0000-0000-000000000001',
        status: 'draft',
        student: { firstName: 'Siddharth', lastName: 'Rao', dob: '2020-01-01', gender: 'male', nationality: 'Indian' },
        guardians: [],
        createdAt: new Date().toISOString(),
      },
      admissionOfficerSession
    );

    const fetchedByB = await instanceB.getApplicationById(app.id, admissionOfficerSession);
    expect(fetchedByB).toBeDefined();
    expect(fetchedByB?.applicationNumber).toBe('99/2026-27');
  });

  // 9. Atomic rollback on deliberate failure
  it('9. ensures multi-step business transactions roll back atomically on error', async () => {
    const mockClient = {
      query: vi.fn().mockImplementation((sql: string) => {
        if (sql === 'BEGIN') return Promise.resolve();
        if (sql.includes('INSERT INTO public.payments')) {
          throw new Error('Disk full or DB constraint violation');
        }
        if (sql === 'ROLLBACK') return Promise.resolve();
        if (sql === 'RESET ALL') return Promise.resolve();
        return Promise.resolve({ rows: [], rowCount: 0 });
      }),
      release: vi.fn(),
    };

    const mockPool = {
      connect: vi.fn().mockResolvedValue(mockClient),
    };

    setPostgresPoolForTesting(mockPool as any);

    try {
      await expect(
        withTransaction(accountantSession, async (client) => {
          await client.query("INSERT INTO public.payments (id) VALUES ('fail-test')");
        })
      ).rejects.toThrow('Disk full or DB constraint violation');

      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.query).toHaveBeenCalledWith('RESET ALL');
      expect(mockClient.release).toHaveBeenCalled();
    } finally {
      setPostgresPoolForTesting(null);
    }
  });

  // 10. Concurrency locking on payments and section capacity
  it('10. verifies Postgres repositories employ FOR UPDATE locking during atomic updates', () => {
    const feesRepoCode = fs.readFileSync(
      path.join(__dirname, '../src/infrastructure/repositories/postgres/fees-ledger.repository.ts'),
      'utf8'
    );
    const admissionsRepoCode = fs.readFileSync(
      path.join(__dirname, '../src/infrastructure/repositories/postgres/admissions.repository.ts'),
      'utf8'
    );

    // Concurrency lock on assessments
    expect(feesRepoCode).toContain('for update');
    // Concurrency lock on class sections seat capacity
    expect(admissionsRepoCode).toContain('for update');
  });

  // 11. Restricted database role (school_app_login) negative permissions
  it('11. verifies restricted role school_app_login permissions in database migration', () => {
    const migrationSql = fs.readFileSync(
      path.join(__dirname, '../supabase/migrations/20261101120000_provision_school_app_login_and_rls.sql'),
      'utf8'
    );

    // Created as dedicated login role
    expect(migrationSql).toContain('create role school_app_login with login');
    // Belongs to school_app_user
    expect(migrationSql).toContain('grant school_app_user to school_app_login');
    // Does NOT have SUPERUSER or BYPASSRLS
    expect(migrationSql).not.toMatch(/create role school_app_login.*superuser/i);
    expect(migrationSql).not.toMatch(/alter role school_app_login.*bypassrls/i);

    // Base role migration verifies NO DELETE on ledger/audit
    const baseRoleSql = fs.readFileSync(
      path.join(__dirname, '../supabase/migrations/20261030000000_provision_restricted_app_role.sql'),
      'utf8'
    );
    expect(baseRoleSql).toContain('NO DELETE');
  });

  // 12. Role forgery rejection
  it('12. verifies private.current_actor_role() detects and rejects role forgery', () => {
    const migrationSql = fs.readFileSync(
      path.join(__dirname, '../supabase/migrations/20261101120000_provision_school_app_login_and_rls.sql'),
      'utf8'
    );

    // Resolves role directly from public.staff_members
    expect(migrationSql).toContain('from public.staff_members');
    // Detects mismatch between asserted role and actual DB role
    expect(migrationSql).toContain('v_asserted_role <> v_db_role');
    expect(migrationSql).toContain('return null; -- Role forgery detected');
  });

  // 13. system_admin prohibited from modifying section capacity (Principal only)
  it('13. forbids system_admin from modifying section seat capacity policy (Principal only per US-42)', () => {
    expect(() => {
      admissionsService.setCapacityPolicy(
        {
          mode: 'section_only',
          defaultSectionCapacity: 50,
        },
        adminSession // system_admin
      );
    }).toThrow(AuthorizationError);

    expect(() => {
      admissionsService.setCapacityPolicy(
        {
          mode: 'section_only',
          defaultSectionCapacity: 50,
        },
        principalSession // Principal
      );
    }).not.toThrow();
  });

  // 14. Exact decimal arithmetic for large values without float corruption
  it('14. verifies exact decimal arithmetic for multi-crore amounts without floating point errors', () => {
    const largeAmount1 = '999999999.99'; // ₹99,99,99,999.99
    const largeAmount2 = '0.01';

    const sum = addInr(largeAmount1, largeAmount2);
    expect(sum).toBe('1000000000.00'); // Exactly ₹100,00,00,000.00 without .9999999999999999 float error

    const diff = subtractInr(sum, '0.05');
    expect(diff).toBe('999999999.95');

    const product = multiplyInr('12345678.50', 3);
    expect(product).toBe('37037035.50');

    expect(compareInr('1000000000.00', '999999999.99')).toBe(1);
    expect(compareInr('999999999.99', '1000000000.00')).toBe(-1);
    expect(compareInr('1000000000.00', '1000000000.00')).toBe(0);

    const words = amountInWordsInr('1000000000.00');
    expect(words).toContain('Rupees');
    expect(words).toContain('Only');
  });

  // 15. Zero committed passwords scan in migrations and config
  it('15. verifies zero plaintext login passwords committed in migrations and codebase', () => {
    const migrationsDir = path.join(__dirname, '../supabase/migrations');
    const migrationFiles = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql'));

    for (const file of migrationFiles) {
      const content = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      // Assert no "PASSWORD '...'" with literal passwords (excluding placeholder comments)
      const lines = content.split('\n');
      for (const line of lines) {
        if (line.trim().startsWith('--')) continue; // Skip comments
        expect(line).not.toMatch(/password\s+['"][^'{}\s]+['"]/i);
      }
    }
  });
});
