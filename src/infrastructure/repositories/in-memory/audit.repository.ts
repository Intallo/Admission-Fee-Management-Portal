import { IAuditRepository } from '../interfaces';
import { AuthenticatedUserSession } from '../../../modules/identity-access/types';
import { auditReportingService } from '../../../modules/audit-reporting/service';

export class InMemoryAuditRepository implements IAuditRepository {
  resetForTesting(): void {
    auditReportingService.resetForTesting();
  }

  async logAction(entry: any, _session?: AuthenticatedUserSession): Promise<void> {
    await auditReportingService.recordAuditEvent(entry);
  }

  async getLogs(
    filter: any,
    session?: AuthenticatedUserSession
  ): Promise<{ data: any[]; total: number }> {
    const res = await auditReportingService.listAuditLogs(filter, session as any);
    return { data: res.data, total: res.total };
  }
}
