import { describe, it, expect, beforeEach, vi } from 'vitest';
import { admissionsService } from '../src/modules/admissions/service';
import { documentsService } from '../src/modules/documents/service';
import { AuthenticatedUserSession } from '../src/modules/identity-access/types';

let currentMockSession: AuthenticatedUserSession = {
  staffId: 'principal-uuid-test',
  authUserId: 'principal-auth-uuid',
  email: 'principal@school-demo.example',
  fullName: 'Demo Principal',
  role: 'principal',
  isActive: true,
  activeAcademicYearId: '00000000-0000-0000-0000-000000000001',
  activeAcademicYearLabel: '2026-2027',
};

vi.mock('@/auth/guards', () => ({
  requireAuthUser: vi.fn(async () => currentMockSession),
  requireRole: vi.fn(async (allowedRoles: string[]) => {
    if (!allowedRoles.includes(currentMockSession.role)) {
      const { AuthorizationError } = await import('../src/lib/errors');
      throw new AuthorizationError(
        `Access Denied: Role "${currentMockSession.role}" is not permitted to perform this operation.`
      );
    }
    return currentMockSession;
  }),
}));

import { GET as listApplicationsRoute, POST as createApplicationRoute } from '../src/app/api/v1/admissions/applications/route';
import { GET as getApplicationRoute, PATCH as updateApplicationRoute } from '../src/app/api/v1/admissions/applications/[id]/route';
import { POST as submitRoute } from '../src/app/api/v1/admissions/applications/[id]/submit/route';
import { POST as approveRoute } from '../src/app/api/v1/admissions/applications/[id]/approve/route';
import { POST as rejectRoute } from '../src/app/api/v1/admissions/applications/[id]/reject/route';
import { POST as holdRoute } from '../src/app/api/v1/admissions/applications/[id]/hold/route';
import { POST as returnToDraftRoute } from '../src/app/api/v1/admissions/applications/[id]/return-to-draft/route';
import { GET as capacityRoute } from '../src/app/api/v1/admissions/capacity/route';
import { POST as uploadDocRoute } from '../src/app/api/v1/documents/upload/route';
import { GET as downloadDocUrlRoute } from '../src/app/api/v1/documents/[id]/download-url/route';

describe('Admissions & Documents API Route Handlers (HTTP Integration)', () => {
  const academicYearId = '00000000-0000-0000-0000-000000000001';
  const std1GradeId = '30000000-0000-0000-0000-000000000004';
  const sectionAId = '40000000-0000-0000-0000-000000000001';

  beforeEach(() => {
    admissionsService.resetForTesting();
    documentsService.resetForTesting();

    // Default to Principal
    currentMockSession = {
      staffId: 'principal-uuid-test',
      authUserId: 'principal-auth-uuid',
      email: 'principal@school-demo.example',
      fullName: 'Demo Principal',
      role: 'principal',
      isActive: true,
      activeAcademicYearId: academicYearId,
      activeAcademicYearLabel: '2026-2027',
    };
  });

  it('POST /api/v1/admissions/applications creates draft and returns 201 Created', async () => {
    currentMockSession.role = 'admission_officer';

    const req = new Request('http://localhost/api/v1/admissions/applications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        academicYearId,
        requestedGradeLevelId: std1GradeId,
        studentFirstName: 'Harish',
        studentLastName: 'Gowda',
        dateOfBirth: '2020-03-10',
        gender: 'male',
        primaryGuardianName: 'Chandrashekar Gowda',
        primaryGuardianPhone: '+919876543210',
      }),
    });

    const res = await createApplicationRoute(req);
    expect(res.status).toBe(201);

    const body = await res.json();
    expect(body.application).toBeDefined();
    expect(body.application.status).toBe('draft');
    expect(body.application.applicationNumber).toMatch(/^\d+\/2026-27$/);
  });

  it('GET /api/v1/admissions/applications lists applications and returns counts', async () => {
    // Create one draft first
    await admissionsService.createDraftApplication(
      {
        academicYearId,
        gradeLevelId: std1GradeId,
        student: {
          firstName: 'Preethi',
          lastName: 'Shenoy',
          dateOfBirth: '2020-01-01',
          gender: 'female',
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
      currentMockSession
    );

    const req = new Request(`http://localhost/api/v1/admissions/applications?academicYearId=${academicYearId}`);
    const res = await listApplicationsRoute(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.items.length).toBeGreaterThanOrEqual(1);
    expect(body.counts).toBeDefined();
    expect(body.counts.draftCount).toBeGreaterThanOrEqual(1);
  });

  it('PATCH /api/v1/admissions/applications/[id] updates draft fields', async () => {
    const draft = await admissionsService.createDraftApplication(
      {
        academicYearId,
        gradeLevelId: std1GradeId,
        student: {
          firstName: 'Karan',
          lastName: 'Roy',
          dateOfBirth: '2020-02-02',
          gender: 'male',
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
      currentMockSession
    );

    const req = new Request(`http://localhost/api/v1/admissions/applications/${draft.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        student: { religion: 'Jain', bloodGroup: 'AB+' },
      }),
    });

    const res = await updateApplicationRoute(req, { params: { id: draft.id } });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.application.student.religion).toBe('Jain');
    expect(body.application.student.bloodGroup).toBe('AB+');
  });

  it('POST /api/v1/admissions/applications/[id]/submit submits application for review', async () => {
    // Submit is done by Admission Officer (per AUTHORIZATION_MATRIX.md)
    currentMockSession.role = 'admission_officer';

    const draft = await admissionsService.createDraftApplication(
      {
        academicYearId,
        gradeLevelId: std1GradeId,
        student: {
          firstName: 'Anil',
          lastName: 'Kumble',
          dateOfBirth: '2020-04-04',
          gender: 'male',
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
      currentMockSession
    );

    const req = new Request(`http://localhost/api/v1/admissions/applications/${draft.id}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        overrideMissingDocumentsReason: 'Direct interview exemption.',
      }),
    });

    const res = await submitRoute(req, { params: { id: draft.id } });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.application.status).toBe('submitted');
  });

  it('POST /api/v1/admissions/applications/[id]/approve completes atomic admission (Operation 1)', async () => {
    // Draft created and submitted by Admission Officer
    currentMockSession.role = 'admission_officer';

    const draft = await admissionsService.createDraftApplication(
      {
        academicYearId,
        gradeLevelId: std1GradeId,
        student: {
          firstName: 'Smriti',
          lastName: 'Mandhana',
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
            relationship: 'Mother',
            mobileNumber: '+919876543210',
            residentialAddress: 'Test',
            isPrimaryContact: true,
          },
        ],
      },
      currentMockSession
    );

    await admissionsService.submitApplication(
      draft.id,
      { overrideMissingDocumentsReason: 'Interview verified' },
      currentMockSession
    );

    // Now switch to Principal for approval
    currentMockSession.role = 'principal';

    // Principal executes atomic approval
    const req = new Request(`http://localhost/api/v1/admissions/applications/${draft.id}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        assignedSectionId: sectionAId,
        remarks: 'Approved by Principal.',
      }),
    });

    const res = await approveRoute(req, { params: { id: draft.id } });
    expect(res.status).toBe(201);

    const body = await res.json();
    expect(body.status).toBe('approved');
    expect(body.admissionNumber).toMatch(/^ADM-2026-\d{4}$/);
    expect(body.feeGenerated).toBe(true);
    expect(body.initialBilledAmountInr).toBe('19700.00');
  });

  it('POST /api/v1/admissions/applications/[id]/approve returns 403 Forbidden when called by Accountant', async () => {
    currentMockSession.role = 'accountant'; // Non-principal role

    const req = new Request(`http://localhost/api/v1/admissions/applications/some-id/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        assignedSectionId: sectionAId,
      }),
    });

    const res = await approveRoute(req, { params: { id: 'some-id' } });
    expect(res.status).toBe(403);

    const body = await res.json();
    expect(body.code).toBe('FORBIDDEN');
  });

  it('GET /api/v1/admissions/capacity returns section capacity details', async () => {
    const req = new Request(`http://localhost/api/v1/admissions/capacity?sectionId=${sectionAId}&academicYearId=${academicYearId}`);
    const res = await capacityRoute(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.capacity).toBeDefined();
    expect(body.capacity.sectionMaxCapacity).toBe(40);
    expect(body.capacity.groupMaxCapacity).toBe(100); // SRS §3 A-08 100-seat cap
  });

  it('GET /api/v1/documents/[id]/download-url returns 403 Forbidden for System Admin', async () => {
    // Upload a document first as Admission Officer
    const doc = await documentsService.uploadDocument(
      {
        studentId: '11111111-1111-1111-1111-111111111111',
        admissionApplicationId: '22222222-2222-2222-2222-222222222222',
        documentTypeId: '10000000-0000-0000-0000-000000000001',
        fileName: 'test.pdf',
        fileSizeBytes: 1024,
        mimeType: 'application/pdf',
      },
      { ...currentMockSession, role: 'admission_officer' }
    );

    // Attempt download URL generation as System Admin
    currentMockSession.role = 'system_admin';

    const req = new Request(`http://localhost/api/v1/documents/${doc.id}/download-url`);
    const res = await downloadDocUrlRoute(req, { params: { id: doc.id } });
    expect(res.status).toBe(403);

    const body = await res.json();
    expect(body.code).toBe('FORBIDDEN');
  });
});
