import { IAuditRepository } from '../interfaces';
import { query } from '../../db/postgres-pool';
import { AuthenticatedUserSession } from '../../../modules/identity-access/types';
import { AuditLogEntryDTO } from '../../../modules/audit-reporting/types';
import { randomUUID } from 'crypto';

export class PostgresAuditRepository implements IAuditRepository {
  async logAction(entry: AuditLogEntryDTO, session?: AuthenticatedUserSession): Promise<void> {
    const id = entry.id || randomUUID();
    const nowIso = entry.createdAt || new Date().toISOString();

    await query(
      `insert into public.audit_logs (
         id, actor_staff_id, action, entity_type, entity_id,
         before_state, after_state, outcome, reason, created_at
       ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        id,
        entry.actorStaffId || session?.staffId || null,
        entry.action,
        entry.entityType || null,
        entry.entityId || null,
        entry.beforeSnapshot ? JSON.stringify(entry.beforeSnapshot) : null,
        entry.afterSnapshot ? JSON.stringify(entry.afterSnapshot) : null,
        entry.outcome || 'success',
        entry.reason || null,
        nowIso,
      ],
      session
    );
  }

  async getLogs(
    filter: {
      staffId?: string;
      action?: string;
      entityType?: string;
      limit?: number;
      offset?: number;
    },
    session: AuthenticatedUserSession
  ): Promise<{ data: AuditLogEntryDTO[]; total: number }> {
    const conditions: string[] = [];
    const params: any[] = [];
    let pIdx = 1;

    if (filter.staffId) {
      conditions.push(`actor_staff_id = $${pIdx++}`);
      params.push(filter.staffId);
    }
    if (filter.action) {
      conditions.push(`action = $${pIdx++}`);
      params.push(filter.action);
    }
    if (filter.entityType) {
      conditions.push(`entity_type = $${pIdx++}`);
      params.push(filter.entityType);
    }

    const where = conditions.length > 0 ? `where ${conditions.join(' and ')}` : '';

    const countRes = await query(
      `select count(*)::int as total from public.audit_logs ${where}`,
      params,
      session
    );
    const total = countRes.rows[0]?.total || 0;

    const limit = filter.limit || 50;
    const offset = filter.offset || 0;

    const listRes = await query(
      `select a.*, s.full_name as actor_name, s.role as actor_role
       from public.audit_logs a
       left join public.staff_members s on s.id = a.actor_staff_id
       ${where}
       order by a.created_at desc
       limit $${pIdx++} offset $${pIdx++}`,
      [...params, limit, offset],
      session
    );

    const data: AuditLogEntryDTO[] = listRes.rows.map((r) => ({
      id: r.id,
      actorStaffId: r.actor_staff_id,
      actorName: r.actor_name || 'System / Batch Job',
      actorRole: r.actor_role || 'system',
      action: r.action,
      entityType: r.entity_type,
      entityId: r.entity_id,
      beforeSnapshot: r.before_state ? JSON.parse(r.before_state) : null,
      afterSnapshot: r.after_state ? JSON.parse(r.after_state) : null,
      outcome: (r.outcome || 'success') as 'success' | 'failure',
      reason: r.reason,
      createdAt: r.created_at,
    }));

    return { data, total };
  }
}
