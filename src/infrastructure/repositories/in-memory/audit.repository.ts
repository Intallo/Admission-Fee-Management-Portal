import { IAuditRepository } from '../interfaces';
import { AuthenticatedUserSession } from '../../../modules/identity-access/types';
import { AuditLogEntryDTO } from '../../../modules/audit-reporting/types';
import { randomUUID } from 'crypto';

export class InMemoryAuditRepository implements IAuditRepository {
  private auditLogs: AuditLogEntryDTO[] = [];

  resetForTesting(): void {
    this.auditLogs = [];
  }

  async recordAuditEvent(input: any, session?: AuthenticatedUserSession): Promise<any> {
    await this.logAction(input, session);
    return input;
  }

  async logAction(entry: any, session?: AuthenticatedUserSession): Promise<void> {
    const id = entry.id || randomUUID();
    const item: AuditLogEntryDTO = {
      id,
      actorStaffId: entry.actorStaffId || session?.staffId || 'system',
      actorName: entry.actorName || session?.fullName || 'System',
      actorRole: entry.actorRole || session?.role || 'system',
      action: entry.action,
      entityType: entry.entityType || 'unknown',
      entityId: entry.entityId || id,
      beforeSnapshot: entry.beforeSnapshot || null,
      afterSnapshot: entry.afterSnapshot || null,
      outcome: entry.outcome || 'success',
      reason: entry.reason || null,
      createdAt: entry.createdAt || new Date().toISOString(),
    };
    this.auditLogs.unshift(item);
  }

  async getLogs(
    filter: any,
    _session?: AuthenticatedUserSession
  ): Promise<{ data: AuditLogEntryDTO[]; total: number }> {
    let logs = [...this.auditLogs];
    if (filter.staffId) {
      logs = logs.filter((l) => l.actorStaffId === filter.staffId);
    }
    if (filter.action) {
      logs = logs.filter((l) => l.action === filter.action);
    }
    if (filter.entityType) {
      logs = logs.filter((l) => l.entityType === filter.entityType);
    }

    const limit = filter.limit || 50;
    const offset = filter.offset || 0;
    return {
      data: logs.slice(offset, offset + limit),
      total: logs.length,
    };
  }
}
