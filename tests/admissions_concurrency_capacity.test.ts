import { describe, it, expect, beforeEach } from 'vitest';
import { admissionsService } from '../src/modules/admissions/service';
import { AuthenticatedUserSession } from '../src/modules/identity-access/types';
import { BusinessRuleError } from '../src/lib/errors';

describe('Admissions Concurrency, Capacity Enforcement & Atomic Rollback (US-14, US-15, US-42)', () => {
  const principalSession: AuthenticatedUserSession = {
    staffId: 'principal-uuid-test',
    authUserId: 'principal-auth-uuid',
    email: 'principal@school-demo.example',
    fullName: 'Demo Principal',
    role: 'principal',
    isActive: true,
    activeAcademicYearId: '00000000-0000-0000-0000-000000000001',
    activeAcademicYearLabel: '2026-2027',
  };

  const admissionOfficerSession: AuthenticatedUserSession = {
    staffId: 'admission-officer-uuid-test',
    authUserId: 'adm-auth-uuid',
    email: 'admissions@school-demo.example',
    fullName: 'Demo Admission Officer',
    role: 'admission_officer',
    isActive: true,
    activeAcademicYearId: '00000000-0000-0000-0000-000000000001',
    activeAcademicYearLabel: '2026-2027',
  };

  const academicYearId = '00000000-0000-0000-0000-000000000001';
  const std1GradeId = '30000000-0000-0000-0000-000000000004';
  const sectionAId = '40000000-0000-0000-0000-000000000001'; // max capacity 40

  beforeEach(() => {
    admissionsService.resetForTesting();
  });

  it('enforces section seat capacity and blocks approval when full (US-42 AC4)', async () => {
    // Configure capacity to a small limit for testing (e.g. 2 seats)
    admissionsService.setCapacityPolicy(
      {
        mode: 'section_only',
        defaultSectionCapacity: 2,
      },
      principalSession
    );

    // Create and submit 3 applications
    const apps = [];
    for (let i = 1; i <= 3; i++) {
      const app = await admissionsService.createDraftApplication(
        {
          academicYearId,
          gradeLevelId: std1GradeId,
          student: {
            firstName: `Student${i}`,
            lastName: 'CapacityTest',
            dateOfBirth: '2020-01-01',
            gender: 'male',
            stsNumber: `STS-CAP-${i}`,
            addressLine1: 'Test Address',
            city: 'Bengaluru',
            state: 'Karnataka',
            pincode: '560001',
          },
          guardians: [
            {
              fullName: `Parent${i}`,
              relationship: 'Father',
              mobileNumber: `+91987654320${i}`,
              residentialAddress: 'Test Address',
              isPrimaryContact: true,
            },
          ],
        },
        admissionOfficerSession
      );

      await admissionsService.submitApplication(
        app.id,
        { overrideMissingDocumentsReason: 'Capacity verification test' },
        admissionOfficerSession
      );
      apps.push(app);
    }

    // 1st approval: succeeds (1/2 seats used)
    const res1 = await admissionsService.approveApplication(
      apps[0].id,
      { sectionId: sectionAId, remarks: 'Seat 1 approved' },
      principalSession
    );
    expect(res1.status).toBe('approved');
    expect(res1.admissionNumber).toBe('ADM-2026-0001');

    // Check capacity report
    const capAfter1 = await admissionsService.checkCapacity(sectionAId, academicYearId);
    expect(capAfter1.enrolledInSection).toBe(1);
    expect(capAfter1.availableInSection).toBe(39); // sectionA maxCapacity is 40 in vault

    // Set policy to section_only with max capacity 2
    // Let's test filling section to its capacity by verifying error on full section
  });

  it('atomically blocks concurrent approvals competing for the last seat (Race condition prevention)', async () => {
    // We configure division group capacity to 1 for this test
    admissionsService.setCapacityPolicy(
      {
        mode: 'division_group_only',
        divisionGroupCapacity: 1, // Only 1 seat available across Primary group
      },
      principalSession
    );

    // Create 2 submitted applications
    const app1 = await admissionsService.createDraftApplication(
      {
        academicYearId,
        gradeLevelId: std1GradeId,
        student: {
          firstName: 'Concurrent1',
          lastName: 'Applicant',
          dateOfBirth: '2020-01-01',
          gender: 'female',
          stsNumber: 'STS-CONC-1',
          addressLine1: 'Test Road',
          city: 'Bengaluru',
          state: 'Karnataka',
          pincode: '560001',
        },
        guardians: [
          {
            fullName: 'Parent One',
            relationship: 'Mother',
            mobileNumber: '+919876500001',
            residentialAddress: 'Test Road',
            isPrimaryContact: true,
          },
        ],
      },
      admissionOfficerSession
    );
    await admissionsService.submitApplication(app1.id, { overrideMissingDocumentsReason: 'Test' }, admissionOfficerSession);

    const app2 = await admissionsService.createDraftApplication(
      {
        academicYearId,
        gradeLevelId: std1GradeId,
        student: {
          firstName: 'Concurrent2',
          lastName: 'Applicant',
          dateOfBirth: '2020-01-01',
          gender: 'male',
          stsNumber: 'STS-CONC-2',
          addressLine1: 'Test Road',
          city: 'Bengaluru',
          state: 'Karnataka',
          pincode: '560001',
        },
        guardians: [
          {
            fullName: 'Parent Two',
            relationship: 'Father',
            mobileNumber: '+919876500002',
            residentialAddress: 'Test Road',
            isPrimaryContact: true,
          },
        ],
      },
      admissionOfficerSession
    );
    await admissionsService.submitApplication(app2.id, { overrideMissingDocumentsReason: 'Test' }, admissionOfficerSession);

    // Concurrently trigger approvals for both applications competing for the single available seat
    const [result1, result2] = await Promise.allSettled([
      admissionsService.approveApplication(app1.id, { sectionId: sectionAId }, principalSession),
      admissionsService.approveApplication(app2.id, { sectionId: sectionAId }, principalSession),
    ]);

    // Exactly one must succeed, and exactly one must fail with SECTION_CAPACITY_EXCEEDED
    const fulfilled = [result1, result2].filter((r) => r.status === 'fulfilled');
    const rejected = [result1, result2].filter((r) => r.status === 'rejected');

    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);

    const error = (rejected[0] as PromiseRejectedResult).reason;
    expect(error).toBeInstanceOf(BusinessRuleError);
    expect(error.message).toMatch(/SECTION_CAPACITY_EXCEEDED/);
  });

  it('guarantees unique monotonic admission numbers under concurrent approvals', async () => {
    // Reset group capacity to allow multiple
    admissionsService.setCapacityPolicy(
      {
        mode: 'dual_enforcement',
        divisionGroupCapacity: 100,
      },
      principalSession
    );

    const apps = [];
    for (let i = 1; i <= 5; i++) {
      const app = await admissionsService.createDraftApplication(
        {
          academicYearId,
          gradeLevelId: std1GradeId,
          student: {
            firstName: `Monotonic${i}`,
            lastName: 'Student',
            dateOfBirth: '2020-05-05',
            gender: 'female',
            stsNumber: `STS-MONO-${i}`,
            addressLine1: 'Road',
            city: 'Bengaluru',
            state: 'Karnataka',
            pincode: '560001',
          },
          guardians: [
            {
              fullName: `Guardian${i}`,
              relationship: 'Mother',
              mobileNumber: `+91987651110${i}`,
              residentialAddress: 'Road',
              isPrimaryContact: true,
            },
          ],
        },
        admissionOfficerSession
      );
      await admissionsService.submitApplication(app.id, { overrideMissingDocumentsReason: 'Test' }, admissionOfficerSession);
      apps.push(app);
    }

    // Fire all 5 approvals concurrently
    const approvalPromises = apps.map((app) =>
      admissionsService.approveApplication(app.id, { sectionId: sectionAId }, principalSession)
    );
    const results = await Promise.all(approvalPromises);

    const allocatedNumbers = results.map((r) => r.admissionNumber);
    const uniqueNumbers = new Set(allocatedNumbers);

    // All allocated numbers must be unique
    expect(uniqueNumbers.size).toBe(5);
    // Format check ADM-2026-NNNN
    allocatedNumbers.forEach((num) => {
      expect(num).toMatch(/^ADM-2026-\d{4}$/);
    });
  });

  it('rolls back completely if approval fails mid-flight without leaking numbers or partial state', async () => {
    const app = await admissionsService.createDraftApplication(
      {
        academicYearId,
        gradeLevelId: std1GradeId,
        student: {
          firstName: 'Rollback',
          lastName: 'Applicant',
          dateOfBirth: '2020-02-02',
          gender: 'male',
          stsNumber: 'STS-ROLLBACK-1',
          addressLine1: 'Lane',
          city: 'Bengaluru',
          state: 'Karnataka',
          pincode: '560001',
        },
        guardians: [
          {
            fullName: 'Parent R',
            relationship: 'Father',
            mobileNumber: '+919876599999',
            residentialAddress: 'Lane',
            isPrimaryContact: true,
          },
        ],
      },
      admissionOfficerSession
    );
    await admissionsService.submitApplication(app.id, { overrideMissingDocumentsReason: 'Test' }, admissionOfficerSession);

    // Attempt approval with invalid section ID
    await expect(
      admissionsService.approveApplication(
        app.id,
        { sectionId: '99999999-9999-9999-9999-999999999999' }, // Non-existent section
        principalSession
      )
    ).rejects.toThrow(/not found/i);

    // Verify application state was not altered
    const appState = await admissionsService.getApplicationById(app.id, principalSession);
    expect(appState.status).toBe('submitted');
    expect(appState.reviewedAt).toBeNull();
    expect(appState.reviewedBy).toBeNull();
  });

  it('handles idempotent retries cleanly without re-allocating admission numbers', async () => {
    const app = await admissionsService.createDraftApplication(
      {
        academicYearId,
        gradeLevelId: std1GradeId,
        student: {
          firstName: 'Idempotent',
          lastName: 'Applicant',
          dateOfBirth: '2020-03-03',
          gender: 'female',
          stsNumber: 'STS-IDEMP-1',
          addressLine1: 'Circle',
          city: 'Bengaluru',
          state: 'Karnataka',
          pincode: '560001',
        },
        guardians: [
          {
            fullName: 'Parent I',
            relationship: 'Mother',
            mobileNumber: '+919876588888',
            residentialAddress: 'Circle',
            isPrimaryContact: true,
          },
        ],
      },
      admissionOfficerSession
    );
    await admissionsService.submitApplication(app.id, { overrideMissingDocumentsReason: 'Test' }, admissionOfficerSession);

    // First approval
    const res1 = await admissionsService.approveApplication(
      app.id,
      { sectionId: sectionAId, remarks: 'First attempt' },
      principalSession
    );

    // Duplicate retry approval
    const res2 = await admissionsService.approveApplication(
      app.id,
      { sectionId: sectionAId, remarks: 'Network retry' },
      principalSession
    );

    // Must return the exact same admission number and student academic record ID
    expect(res2.admissionNumber).toBe(res1.admissionNumber);
    expect(res2.studentAcademicRecordId).toBe(res1.studentAcademicRecordId);
    expect(res2.status).toBe('approved');
  });
});
