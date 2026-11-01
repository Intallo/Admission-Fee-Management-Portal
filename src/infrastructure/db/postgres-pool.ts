import 'server-only';
import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { getServerEnv } from '../../lib/env';
import { assertServerOnly, assertDisposableDatabase } from './guards';
import { AuthenticatedUserSession } from '../../modules/identity-access/types';
import { logger } from '../../lib/logger';

let singletonPool: Pool | null = null;

/**
 * Creates or retrieves the singleton server-only PostgreSQL connection pool.
 * Uses direct connection credentials configured in DATABASE_URL.
 * Replaces privileged service_role Supabase client for runtime business operations.
 */
export function getPostgresPool(): Pool {
  assertServerOnly();
  const env = getServerEnv();
  const databaseUrl = env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

  assertDisposableDatabase(databaseUrl);

  if (!singletonPool) {
    singletonPool = new Pool({
      connectionString: databaseUrl,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
      statement_timeout: 15000,
    });

    singletonPool.on('error', (err) => {
      logger.error('Unexpected error on idle PostgreSQL client in pool', { error: err.message });
    });
  }

  return singletonPool;
}

/**
 * Executes an isolated transaction with transaction-local actor context for RLS scoping.
 * Guarantees atomicity, automatic rollback on error, and strict cleanup of session variables upon return.
 */
export async function withTransaction<T>(
  actorSession: AuthenticatedUserSession | null,
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const pool = getPostgresPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    if (actorSession) {
      await client.query(
        "SELECT set_config('app.current_staff_id', $1, true), set_config('app.current_role', $2, true)",
        [actorSession.staffId, actorSession.role]
      );
    } else {
      await client.query(
        "SELECT set_config('app.current_staff_id', '', true), set_config('app.current_role', '', true)"
      );
    }

    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackErr) {
      logger.error('Failed to rollback transaction', { error: String(rollbackErr) });
    }
    throw error;
  } finally {
    try {
      // Clean up session variables to prevent leakage across pooled connections
      await client.query('RESET ALL');
    } catch {
      // Ignore cleanup error if connection was terminated
    }
    client.release();
  }
}

/**
 * Executes a parameterized query within optional actor session context.
 */
export async function query<R extends QueryResultRow = any>(
  text: string,
  params: any[] = [],
  actorSession?: AuthenticatedUserSession | null
): Promise<QueryResult<R>> {
  if (actorSession) {
    return withTransaction(actorSession, (client) => client.query<R>(text, params));
  }
  const pool = getPostgresPool();
  return pool.query<R>(text, params);
}

/**
 * Injects a mock pool for isolated testing.
 */
export function setPostgresPoolForTesting(pool: Pool | null): void {
  singletonPool = pool;
}

/**
 * Gracefully closes the connection pool (used during test teardown).
 */
export async function closePostgresPool(): Promise<void> {
  if (singletonPool) {
    const pool = singletonPool;
    singletonPool = null;
    await pool.end();
  }
}
