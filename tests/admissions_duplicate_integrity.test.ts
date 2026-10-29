import { describe, it, expect, beforeEach } from 'vitest';
import { admissionsService } from '../src/modules/admissions/service';
import { AuthenticatedUserSession } from '../src/modules/identity-access/types';
import { ConflictError, BusinessRuleError, ValidationError, NotFoundError } from '../src/lib/errors';

describe('Admissions Duplicate Checks, State Machine & Database Integrity (US-08 AC5, SBR-05)', () => {
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
    staffId: 'adm-uuid-test',
    authUserId: 'adm-auth-uuid',
    email: 'admissions@school-demo.example',
    fullName: 'Demo Admission Officer',
    role: 'admission_officer',
    isActive: true,
    activeAcademicYearId: '00000000-0000-0000-0000-000000000001',
    activeAcademicYearLabel: '2026-2027',
  };

  const academicYearId = '00000000-0000-0000-0000-000000000001';
  const closedYearId = '00000000-0000-0000-0000-000000000000'; // Closed 2025-2026
  const std1GradeId = '30000000-0000-0000-0000-000000000004';
  const sectionAId = '40000000-0000-0000-0000-000000000001';

  beforeEach(() => {
    admissionsService.resetForTesting();
  });

  it('rejects duplicate Karnataka STS number and names the existing student (US-08 AC5)', async () => {
    // 1. Create first student with STS number
    await admissionsService.createDraftApplication(
      {
        academicYearId,
        gradeLevelId: std1GradeId,
        student: {
          firstName: 'Pranav',
          lastName: 'Dixit',
          dateOfBirth: '2020-01-10',
          gender: 'male',
          stsNumber: 'KAR-STS-12345',
          addressLine1: 'Test Address',
          city: 'Bengaluru',
          state: 'Karnataka',
          pincode: '560001',
        },
        guardians: [
          {
            fullName: 'Alok Dixit',
            relationship: 'Father',
            mobileNumber: '+919876543210',
            residentialAddress: 'Test Address',
            isPrimaryContact: true,
          },
        ],
      },
      admissionOfficerSession
    );

    // 2. Attempt to create another student with the exact same STS number
    await expect(
      admissionsService.createDraftApplication(
        {
          academicYearId,
          gradeLevelId: std1GradeId,
          student: {
            firstName: 'Naveen',
            lastName: 'Kumar',
            dateOfBirth: '2020-02-20',
            gender: 'male',
            stsNumber: 'KAR-STS-12345', // Duplicate STS
            addressLine1: 'Other Address',
            city: 'Bengaluru',
            state: 'Karnataka',
            pincode: '560002',
          },
          guardians: [
            {
              fullName: 'Suresh Kumar',
              relationship: 'Father',
              mobileNumber: '+919876543211',
              residentialAddress: 'Other Address',
              isPrimaryContact: true,
            },
          ],
        },
        admissionOfficerSession
      )
    ).rejects.toThrow(/is already registered to existing student "Pranav Dixit"/);
  });

  it('rejects duplicate Aadhaar numbers across applicants using HMAC hashing', async () => {
    await admissionsService.createDraftApplication(
      {
        academicYearId,
        gradeLevelId: std1GradeId,
        student: {
          firstName: 'Meera',
          lastName: 'Nair',
          dateOfBirth: '2020-03-15',
          gender: 'female',
          addressLine1: 'Test',
          city: 'Bengaluru',
          state: 'Karnataka',
          pincode: '560001',
        },
        sensitiveDetails: {
          aadhaarNumber: '111122223333',
        },
        guardians: [
          {
            fullName: 'Nair Parent',
            relationship: 'Mother',
            mobileNumber: '+919876543210',
            residentialAddress: 'Test',
            isPrimaryContact: true,
          },
        ],
      },
      admissionOfficerSession
    );

    // Attempt second application with same Aadhaar
    await expect(
      admissionsService.createDraftApplication(
        {
          academicYearId,
          gradeLevelId: std1GradeId,
          student: {
            firstName: 'Pooja',
            lastName: 'Nair',
            dateOfBirth: '2020-04-15',
            gender: 'female',
            addressLine1: 'Test 2',
            city: 'Bengaluru',
            state: 'Karnataka',
            pincode: '560001',
          },
          sensitiveDetails: {
            aadhaarNumber: '1111 2222 3333', // Same with spaces
          },
          guardians: [
            {
              fullName: 'Nair Parent 2',
              relationship: 'Father',
              mobileNumber: '+919876543212',
              residentialAddress: 'Test 2',
              isPrimaryContact: true,
            },
          ],
        },
        admissionOfficerSession
      )
    ).rejects.toThrow(/student with this Aadhaar number is already registered/i);
  });

  it('blocks application creation and approval in closed academic years (SBR-05)', async () => {
    // Attempt draft creation targeting closed 2025-2026 year
    await expect(
      admissionsService.createDraftApplication(
        {
          academicYearId: closedYearId,
          gradeLevelId: std1GradeId,
          student: {
            firstName: 'Late',
            lastName: 'Applicant',
            dateOfBirth: '2019-01-01',
            gender: 'male',
            addressLine1: 'Road',
            city: 'Bengaluru',
            state: 'Karnataka',
            pincode: '560001',
          },
          guardians: [
            {
              fullName: 'Parent',
              relationship: 'Father',
              mobileNumber: '+919876543210',
              residentialAddress: 'Road',
              isPrimaryContact: true,
            },
          ],
        },
        admissionOfficerSession
      )
    ).rejects.toThrow(/closed and strictly read-only/i);
  });

  it('enforces valid status state transitions and rejects illegal moves', async () => {
    const draft = await admissionsService.createDraftApplication(
      {
        academicYearId,
        gradeLevelId: std1GradeId,
        student: {
          firstName: 'State',
          lastName: 'Machine',
          dateOfBirth: '2020-05-05',
          gender: 'female',
          addressLine1: 'Test',
          city: 'Bengaluru',
          state: 'Karnataka',
          pincode: '560001',
        },
        guardians: [
          {
            fullName: 'Parent',
            relationship: 'Father',
            mobileNumber: '+919876543210',
            residentialAddress: 'Test',
            isPrimaryContact: true,
          },
        ],
      },
      admissionOfficerSession
    );

    // 1. Cannot approve a draft directly without submitting
    await expect(
      admissionsService.approveApplication(draft.id, { sectionId: sectionAId }, principalSession)
    ).rejects.toThrow(/Cannot approve application in state "draft"/);

    // 2. Submit application
    await admissionsService.submitApplication(draft.id, { overrideMissingDocumentsReason: 'Ok' }, admissionOfficerSession);

    // 3. Principal rejects with valid reason
    const rejected = await admissionsService.rejectApplication(
      draft.id,
      'Does not meet age criteria for Class 1 admission.',
      principalSession
    );
    expect(rejected.status).toBe('rejected');

    // 4. Cannot approve a rejected application
    await expect(
      admissionsService.approveApplication(draft.id, { sectionId: sectionAId }, principalSession)
    ).rejects.toThrow(/Cannot approve application in state "rejected"/);
  });

  it('rejects rejections with insufficient reason (< 5 characters)', async () => {
    const draft = await admissionsService.createDraftApplication(
      {
        academicYearId,
        gradeLevelId: std1GradeId,
        student: {
          firstName: 'Short',
          lastName: 'Reason',
          dateOfBirth: '2020-05-05',
          gender: 'male',
          addressLine1: 'Test',
          city: 'Bengaluru',
          state: 'Karnataka',
          pincode: '560001',
        },
        guardians: [
          {
            fullName: 'Parent',
            relationship: 'Mother',
            mobileNumber: '+919876543210',
            residentialAddress: 'Test',
            isPrimaryContact: true,
          },
        ],
      },
      admissionOfficerSession
    );
    await admissionsService.submitApplication(draft.id, { overrideMissingDocumentsReason: 'Ok' }, admissionOfficerSession);

    await expect(
      admissionsService.rejectApplication(draft.id, 'No', principalSession)
    ).rejects.toThrow(ValidationError);
  });
});
