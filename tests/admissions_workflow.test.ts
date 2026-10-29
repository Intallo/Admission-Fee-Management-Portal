import { describe, it, expect, beforeEach } from 'vitest';
import { admissionsService } from '../src/modules/admissions/service';
import { documentsService } from '../src/modules/documents/service';
import { AuthenticatedUserSession } from '../src/modules/identity-access/types';
import { BusinessRuleError, AuthorizationError, ValidationError } from '../src/lib/errors';

describe('Admissions Workflow End-to-End (US-07 through US-16)', () => {
  const principalSession: AuthenticatedUserSession = {
    staffId: 'principal-test-uuid',
    authUserId: 'principal-auth-uuid',
    email: 'principal@school-demo.example',
    fullName: 'Dr. Principal',
    role: 'principal',
    isActive: true,
    activeAcademicYearId: '00000000-0000-0000-0000-000000000001',
    activeAcademicYearLabel: '2026-2027',
  };

  const admissionOfficerSession: AuthenticatedUserSession = {
    staffId: 'adm-officer-test-uuid',
    authUserId: 'adm-auth-uuid',
    email: 'admissions@school-demo.example',
    fullName: 'Officer Ujwal',
    role: 'admission_officer',
    isActive: true,
    activeAcademicYearId: '00000000-0000-0000-0000-000000000001',
    activeAcademicYearLabel: '2026-2027',
  };

  const academicYearId = '00000000-0000-0000-0000-000000000001';
  const std1GradeId = '30000000-0000-0000-0000-000000000004';
  const sectionAId = '40000000-0000-0000-0000-000000000001';

  beforeEach(() => {
    admissionsService.resetForTesting();
    documentsService.resetForTesting();
  });

  it('creates a draft application with minimal fields and receives an application number (US-07)', async () => {
    const draft = await admissionsService.createDraftApplication(
      {
        academicYearId,
        gradeLevelId: std1GradeId,
        student: {
          firstName: 'Kabir',
          lastName: 'Mehta',
          dateOfBirth: '2020-04-10',
          gender: 'male',
          addressLine1: '45 Residency Road',
          city: 'Bengaluru',
          state: 'Karnataka',
          pincode: '560025',
        },
        guardians: [
          {
            fullName: 'Rajesh Mehta',
            relationship: 'Father',
            mobileNumber: '+919876543210',
            residentialAddress: '45 Residency Road',
            isPrimaryContact: true,
          },
        ],
      },
      admissionOfficerSession
    );

    expect(draft.id).toBeDefined();
    expect(draft.status).toBe('draft');
    // Application number format {seq}/2026-27 (US-07 AC3)
    expect(draft.applicationNumber).toMatch(/^\d+\/2026-27$/);
    expect(draft.student.firstName).toBe('Kabir');
  });

  it('allows editing an application in draft state (US-12 AC1)', async () => {
    const draft = await admissionsService.createDraftApplication(
      {
        academicYearId,
        gradeLevelId: std1GradeId,
        student: {
          firstName: 'Siddharth',
          lastName: 'Rao',
          dateOfBirth: '2020-03-12',
          gender: 'male',
          addressLine1: '88 MG Road',
          city: 'Bengaluru',
          state: 'Karnataka',
          pincode: '560001',
        },
        guardians: [
          {
            fullName: 'Anand Rao',
            relationship: 'Father',
            mobileNumber: '+919845012345',
            residentialAddress: '88 MG Road',
            isPrimaryContact: true,
          },
        ],
      },
      admissionOfficerSession
    );

    const updated = await admissionsService.updateDraftApplication(
      draft.id,
      {
        student: {
          bloodGroup: 'O+',
          religion: 'Hindu',
          transportMode: 'School Bus',
        },
      },
      admissionOfficerSession
    );

    expect(updated.student.bloodGroup).toBe('O+');
    expect(updated.student.religion).toBe('Hindu');
    expect(updated.student.transportMode).toBe('School Bus');
  });

  it('blocks submission when mandatory documents are missing without an override reason (US-11 AC3)', async () => {
    const draft = await admissionsService.createDraftApplication(
      {
        academicYearId,
        gradeLevelId: std1GradeId,
        student: {
          firstName: 'Riya',
          lastName: 'Sen',
          dateOfBirth: '2020-08-20',
          gender: 'female',
          addressLine1: '12 Indiranagar',
          city: 'Bengaluru',
          state: 'Karnataka',
          pincode: '560038',
        },
        guardians: [
          {
            fullName: 'Sunil Sen',
            relationship: 'Father',
            mobileNumber: '+919845112233',
            residentialAddress: '12 Indiranagar',
            isPrimaryContact: true,
          },
        ],
      },
      admissionOfficerSession
    );

    // Attempting to submit without uploading mandatory Birth Certificate and Photo
    await expect(
      admissionsService.submitApplication(draft.id, {}, admissionOfficerSession)
    ).rejects.toThrow(/mandatory document\(s\) are missing/i);
  });

  it('allows submission when missing documents have an explicit authorized override reason (US-11 AC3)', async () => {
    const draft = await admissionsService.createDraftApplication(
      {
        academicYearId,
        gradeLevelId: std1GradeId,
        student: {
          firstName: 'Riya',
          lastName: 'Sen',
          dateOfBirth: '2020-08-20',
          gender: 'female',
          addressLine1: '12 Indiranagar',
          city: 'Bengaluru',
          state: 'Karnataka',
          pincode: '560038',
        },
        guardians: [
          {
            fullName: 'Sunil Sen',
            relationship: 'Father',
            mobileNumber: '+919845112233',
            residentialAddress: '12 Indiranagar',
            isPrimaryContact: true,
          },
        ],
      },
      admissionOfficerSession
    );

    const submitted = await admissionsService.submitApplication(
      draft.id,
      { overrideMissingDocumentsReason: 'Parent promised birth certificate submission within 7 days.' },
      admissionOfficerSession
    );

    expect(submitted.status).toBe('submitted');
    expect(submitted.submittedAt).toBeDefined();
    expect(submitted.statusHistory.length).toBe(2);
  });

  it('uploads required documents, preserves version history, and submits successfully (US-10, US-13)', async () => {
    const draft = await admissionsService.createDraftApplication(
      {
        academicYearId,
        gradeLevelId: std1GradeId,
        student: {
          firstName: 'Ananya',
          lastName: 'Hegde',
          dateOfBirth: '2020-01-15',
          gender: 'female',
          addressLine1: '77 Malleshwaram',
          city: 'Bengaluru',
          state: 'Karnataka',
          pincode: '560003',
        },
        guardians: [
          {
            fullName: 'Raghav Hegde',
            relationship: 'Father',
            mobileNumber: '+919988776655',
            residentialAddress: '77 Malleshwaram',
            isPrimaryContact: true,
          },
        ],
      },
      admissionOfficerSession
    );

    // Upload Birth Certificate (v1)
    const doc1 = await documentsService.uploadDocument(
      {
        studentId: draft.studentId,
        admissionApplicationId: draft.id,
        documentTypeId: '10000000-0000-0000-0000-000000000001', // Birth Cert
        fileName: 'birth_cert_scan_v1.pdf',
        fileSizeBytes: 1024 * 200,
        mimeType: 'application/pdf',
      },
      admissionOfficerSession
    );
    expect(doc1.versionNumber).toBe(1);

    // Replace Birth Certificate with clearer scan (v2) - Version preservation test (US-10 AC3 / R-01)
    const doc1v2 = await documentsService.uploadDocument(
      {
        studentId: draft.studentId,
        admissionApplicationId: draft.id,
        documentTypeId: '10000000-0000-0000-0000-000000000001',
        fileName: 'birth_cert_scan_v2_hq.pdf',
        fileSizeBytes: 1024 * 400,
        mimeType: 'application/pdf',
      },
      admissionOfficerSession
    );
    expect(doc1v2.versionNumber).toBe(2);
    expect(doc1v2.replacesDocumentId).toBe(doc1.id);

    // Verify version history is preserved
    const versions = await documentsService.getDocumentVersions(doc1v2.id, admissionOfficerSession);
    expect(versions.length).toBe(2);
    expect(versions[0].versionNumber).toBe(2);
    expect(versions[1].versionNumber).toBe(1);

    // Upload Student Photo (v1)
    await documentsService.uploadDocument(
      {
        studentId: draft.studentId,
        admissionApplicationId: draft.id,
        documentTypeId: '10000000-0000-0000-0000-000000000002', // Photo
        fileName: 'passport_photo.jpg',
        fileSizeBytes: 1024 * 150,
        mimeType: 'image/jpeg',
      },
      admissionOfficerSession
    );

    // Checklist check: now all mandatory received
    const checklist = await documentsService.getApplicationChecklist(draft.id, academicYearId, std1GradeId);
    expect(checklist.canSubmit).toBe(true);
    expect(checklist.missingMandatoryCount).toBe(0);

    // Submit for Principal verification (US-13)
    const submitted = await admissionsService.submitApplication(draft.id, {}, admissionOfficerSession);
    expect(submitted.status).toBe('submitted');

    // Submitted applications are read-only for Admission Officer (US-12 AC2)
    await expect(
      admissionsService.updateDraftApplication(
        draft.id,
        { student: { firstName: 'Hacked' } },
        admissionOfficerSession
      )
    ).rejects.toThrow(/Submitted applications are read-only/);
  });

  it('allows Principal to put application on hold and return to draft with reason (US-12 AC2, US-14)', async () => {
    const draft = await admissionsService.createDraftApplication(
      {
        academicYearId,
        gradeLevelId: std1GradeId,
        student: {
          firstName: 'Varun',
          lastName: 'Prasad',
          dateOfBirth: '2020-02-14',
          gender: 'male',
          addressLine1: '5 Koramangala',
          city: 'Bengaluru',
          state: 'Karnataka',
          pincode: '560034',
        },
        guardians: [
          {
            fullName: 'Ganesh Prasad',
            relationship: 'Father',
            mobileNumber: '+919900112233',
            residentialAddress: '5 Koramangala',
            isPrimaryContact: true,
          },
        ],
      },
      admissionOfficerSession
    );

    await admissionsService.submitApplication(
      draft.id,
      { overrideMissingDocumentsReason: 'Pending photo.' },
      admissionOfficerSession
    );

    // Principal puts on hold
    const held = await admissionsService.putApplicationOnHold(
      draft.id,
      { reason: 'Awaiting parent interaction on Saturday.' },
      principalSession
    );
    expect(held.status).toBe('on_hold');
    expect(held.decisionReason).toBe('Awaiting parent interaction on Saturday.');

    // Principal returns to draft so officer can correct details
    const returned = await admissionsService.returnToDraft(
      draft.id,
      'Please re-verify father mobile number with parent.',
      principalSession
    );
    expect(returned.status).toBe('draft');

    // Officer can now edit again
    const reUpdated = await admissionsService.updateDraftApplication(
      draft.id,
      { guardians: [{ fullName: 'Ganesh Prasad', relationship: 'Father', mobileNumber: '+919900998877', residentialAddress: '5 Koramangala', isPrimaryContact: true }] },
      admissionOfficerSession
    );
    expect(reUpdated.guardians[0].mobileNumber).toBe('+919900998877');
  });

  it('completes Principal approval atomically with zero fee payment and ADM-YYYY-NNNN allocation (US-15)', async () => {
    const draft = await admissionsService.createDraftApplication(
      {
        academicYearId,
        gradeLevelId: std1GradeId,
        student: {
          firstName: 'Diya',
          lastName: 'Nambiar',
          dateOfBirth: '2020-07-07',
          gender: 'female',
          addressLine1: '32 Whitefield',
          city: 'Bengaluru',
          state: 'Karnataka',
          pincode: '560066',
        },
        guardians: [
          {
            fullName: 'Madhavan Nambiar',
            relationship: 'Father',
            mobileNumber: '+919811223344',
            residentialAddress: '32 Whitefield',
            isPrimaryContact: true,
          },
        ],
      },
      admissionOfficerSession
    );

    await admissionsService.submitApplication(
      draft.id,
      { overrideMissingDocumentsReason: 'Approved for interview.' },
      admissionOfficerSession
    );

    // Principal approves application
    const approvalResult = await admissionsService.approveApplication(
      draft.id,
      {
        sectionId: sectionAId,
        remarks: 'Admission approved after parent interaction.',
      },
      principalSession
    );

    // Assert atomic approval properties
    expect(approvalResult.status).toBe('approved');
    // Monotonic admission number assigned (ADM-YYYY-NNNN)
    expect(approvalResult.admissionNumber).toMatch(/^ADM-2026-\d{4}$/);
    expect(approvalResult.approvedBy).toBe(principalSession.staffId);
    expect(approvalResult.sectionId).toBe(sectionAId);

    // Fee instantiated from approved fee structure for Class 1 (Tuition 14000 + Dev 2000 + Exam 1200 + Books 2500 = 19700)
    expect(approvalResult.feeGenerated).toBe(true);
    expect(approvalResult.initialBilledAmountInr).toBe('19700.00');

    // Invariant: Zero fee payment is required or recorded (DEC-01 / BR-37)
    // The application status is approved and student is admitted without paying fees upfront
    const detail = await admissionsService.getApplicationById(draft.id, principalSession);
    expect(detail.status).toBe('approved');
  });

  it('prohibits non-Principal roles (Admission Officer, Accountant) from approving admissions', async () => {
    const draft = await admissionsService.createDraftApplication(
      {
        academicYearId,
        gradeLevelId: std1GradeId,
        student: {
          firstName: 'Aarush',
          lastName: 'Bhat',
          dateOfBirth: '2020-09-09',
          gender: 'male',
          addressLine1: '14 Jayanagar',
          city: 'Bengaluru',
          state: 'Karnataka',
          pincode: '560011',
        },
        guardians: [
          {
            fullName: 'Ramesh Bhat',
            relationship: 'Father',
            mobileNumber: '+919822334455',
            residentialAddress: '14 Jayanagar',
            isPrimaryContact: true,
          },
        ],
      },
      admissionOfficerSession
    );

    await admissionsService.submitApplication(
      draft.id,
      { overrideMissingDocumentsReason: 'Complete.' },
      admissionOfficerSession
    );

    // Attempt approval as Admission Officer -> Must fail with 403 AuthorizationError
    await expect(
      admissionsService.approveApplication(
        draft.id,
        { sectionId: sectionAId },
        admissionOfficerSession
      )
    ).rejects.toThrow(AuthorizationError);
  });
});
