import { ICertificatesRepository } from '../interfaces';
import { AuthenticatedUserSession } from '../../../modules/identity-access/types';
import { certificatesService } from '../../../modules/certificates-lctc/service';

export class InMemoryCertificatesRepository implements ICertificatesRepository {
  resetForTesting(): void {
    certificatesService.resetForTesting();
  }

  async prepopulateCertificate(studentAcademicRecordId: string, session?: AuthenticatedUserSession): Promise<any> {
    return certificatesService.prepopulateYearCertificates(studentAcademicRecordId, session as any);
  }

  async getCertificateById(certificateId: string, session?: AuthenticatedUserSession): Promise<any> {
    return certificatesService.getCertificateById(certificateId, session as any);
  }

  async getCertificateByStudentRecordId(studentRecordId: string, session?: AuthenticatedUserSession): Promise<any> {
    const list = await certificatesService.listCertificates({}, session as any);
    return list.data.find((c: any) => c.studentAcademicRecordId === studentRecordId);
  }

  async reviewCertificate(
    certificateId: string,
    payload: any,
    session?: AuthenticatedUserSession
  ): Promise<any> {
    return certificatesService.reviewCertificate(certificateId, payload, session as any);
  }

  async issueCertificate(
    certificateId: string,
    payload: any,
    session?: AuthenticatedUserSession
  ): Promise<any> {
    return certificatesService.issueCertificate(certificateId, payload, session as any);
  }

  async reprintCertificate(
    certificateId: string,
    reason: string,
    session?: AuthenticatedUserSession
  ): Promise<any> {
    return certificatesService.reprintCertificate(certificateId, { reason } as any, session as any);
  }
}
