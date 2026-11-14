import { IAuditRepository } from '../interfaces';
import { query } from '../../db/postgres-pool';
import { PoolClient } from 'pg';
import { AuthenticatedUserSession } from '../../../modules/identity-access/types';
import { AuditLogEntryDTO } from '../../../modules/audit-reporting/types';

export class PostgresAuditRepository implements IAuditRepository {
  private async insertAuditLog(
    entry: any,
    session?: AuthenticatedUserSession,
    existingClient?: PoolClient
  ): Promise<string | undefined> {
    const nowIso = entry.createdAt || new Date().toISOString();

    const sql = `insert into public.audit_logs (
         actor_staff_id, action, entity_type, entity_id,
         before_snapshot, after_snapshot, outcome, reason, created_at
       ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       returning id`;
    const params = [
      entry.actorStaffId || session?.staffId || null,
      entry.action,
      entry.entityType || null,
      entry.entityId || null,
      entry.beforeSnapshot ? JSON.stringify(entry.beforeSnapshot) : null,
      entry.afterSnapshot ? JSON.stringify(entry.afterSnapshot) : null,
      entry.outcome || 'success',
      entry.reason || null,
      nowIso,
    ];

    const result = existingClient
      ? await existingClient.query(sql, params)
      : await query(sql, params, session as any);
    const generatedId = result.rows[0]?.id;
    return generatedId === undefined || generatedId === null ? undefined : String(generatedId);
  }

  async logAction(
    entry: any,
    session?: AuthenticatedUserSession,
    existingClient?: PoolClient
  ): Promise<void> {
    await this.insertAuditLog(entry, session, existingClient);
  }

  async recordAuditEvent(
    input: any,
    session?: AuthenticatedUserSession,
    existingClient?: PoolClient
  ): Promise<any> {
    const id = await this.insertAuditLog(input, session, existingClient);
    return id === undefined ? { ...input } : { ...input, id };
  }

  async getLogs(
    filter: {
      staffId?: string;
      action?: string;
      entityType?: string;
      limit?: number;
      offset?: number;
    },
    session?: AuthenticatedUserSession,
    existingClient?: PoolClient
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

    const queryFn = existingClient
      ? (text: string, p: any[]) => existingClient.query(text, p)
      : (text: string, p: any[]) => query(text, p, session as any);

    const countRes = await queryFn(
      `select count(*)::int as total from public.audit_logs ${where}`,
      params
    );
    const total = countRes.rows[0]?.total || 0;

    const limit = filter.limit || 50;
    const offset = filter.offset || 0;

    const listRes = await queryFn(
      `select a.*, s.full_name as actor_name, s.role as actor_role
       from public.audit_logs a
       left join public.staff_members s on s.id = a.actor_staff_id
       ${where}
       order by a.created_at desc
       limit $${pIdx++} offset $${pIdx++}`,
      [...params, limit, offset]
    );

    const parseSnapshot = (value: unknown): Record<string, unknown> | null => {
      if (value === null || value === undefined) return null;
      if (typeof value === 'string') return JSON.parse(value) as Record<string, unknown> | null;
      return value as Record<string, unknown>;
    };

    const data: AuditLogEntryDTO[] = listRes.rows.map((r: any) => ({
      id: String(r.id),
      actorStaffId: r.actor_staff_id,
      actorName: r.actor_name || 'System / Batch Job',
      actorRole: r.actor_role || 'system',
      action: r.action,
      entityType: r.entity_type,
      entityId: r.entity_id,
      beforeSnapshot: parseSnapshot(r.before_snapshot),
      afterSnapshot: parseSnapshot(r.after_snapshot),
      outcome: (r.outcome || 'success') as 'success' | 'failure',
      reason: r.reason,
      createdAt: r.created_at,
    }));

    return { data, total };
  }
}
