import 'server-only';
import crypto from 'crypto';
import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { getServerEnv } from '../../lib/env';
import { assertServerOnly, assertDisposableDatabase } from './guards';
import { AuthenticatedUserSession } from '../../modules/identity-access/types';
import { logger } from '../../lib/logger';

let singletonPool: Pool | null = null;

/**
 * Generates an HMAC-SHA256 signature for actor verification in PostgreSQL RLS context.
 * Used by private.current_actor_role() to prevent caller role spoofing.
 */
export function generateActorSignature(staffId: string, role: string, secretOverride?: string): string {
  const secret = secretOverride !== undefined ? secretOverride : process.env.ACTOR_SIGNING_SECRET;
  if (!secret || secret.trim() === '') {
    throw new Error(
      '[SECURITY ERROR] ACTOR_SIGNING_SECRET is not configured. Protected transactions require an explicit signing secret.'
    );
  }
  if (secret.length < 32) {
    throw new Error(
      '[SECURITY ERROR] ACTOR_SIGNING_SECRET must be at least 32 characters long for cryptographic security.'
    );
  }
  return crypto.createHmac('sha256', secret).update(`${staffId}:${role}`).digest('hex');
}

/**
 * Creates or retrieves the singleton server-only PostgreSQL connection pool.
 * Requires an explicit DATABASE_URL.
 * Prohibits superuser/service_role accounts in production runtime.
 */
export function getPostgresPool(): Pool {
  assertServerOnly();
  if (singletonPool) {
    return singletonPool;
  }

  const env = getServerEnv();
  const databaseUrl = env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error(
      '[CRITICAL CONFIG ERROR] PostgreSQL pool requires explicit DATABASE_URL. Implicit fallback connections are strictly prohibited.'
    );
  }

  assertDisposableDatabase(databaseUrl);

  // In production, enforce that ordinary operations connect via restricted school_app_login role
  if (process.env.NODE_ENV === 'production') {
    try {
      const parsedUrl = new URL(databaseUrl);
      const username = decodeURIComponent(parsedUrl.username || '').toLowerCase();
      const forbiddenRoles = ['postgres', 'supabase_admin', 'postgres_admin', 'root', 'service_role'];
      if (forbiddenRoles.includes(username)) {
        throw new Error(
          `[SECURITY ERROR] Production runtime pool cannot connect as privileged user "${username}". Must use restricted login role "school_app_login".`
        );
      }
    } catch (err: any) {
      if (err.message.startsWith('[SECURITY ERROR]')) {
        throw err;
      }
      // Malformed URL will fail in pg.Pool constructor
    }
  }

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
 * Actor session is mandatory to prevent actorless queries against protected tables.
 */
export async function withTransaction<T>(
  actorSession: AuthenticatedUserSession,
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  if (!actorSession || !actorSession.staffId || !actorSession.role) {
    throw new Error(
      '[SECURITY ERROR] Cannot execute transaction: valid actorSession is mandatory for protected application operations.'
    );
  }

  if (actorSession.staffId === '00000000-0000-0000-0000-000000000000') {
    throw new Error(
      '[SECURITY ERROR] Synthetic zero UUID placeholder session is strictly prohibited in database transactions.'
    );
  }



  const pool = getPostgresPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Scoped transaction context with cryptographic HMAC-SHA256 signature
    const signature = generateActorSignature(actorSession.staffId, actorSession.role);
    await client.query(
      "SELECT set_config('app.current_staff_id', $1, true), set_config('app.current_role', $2, true), set_config('app.actor_signature', $3, true)",
      [actorSession.staffId, actorSession.role, signature]
    );

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
 * Executes an isolated transaction for unauthenticated system operations (e.g. login credentials lookup).
 * Prohibits accessing protected business tables without an active actor.
 */
export async function withSystemTransaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {


  const pool = getPostgresPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    // Clear actor context
    await client.query(
      "SELECT set_config('app.current_staff_id', '', true), set_config('app.current_role', '', true), set_config('app.actor_signature', '', true)"
    );

    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackErr) {
      logger.error('Failed to rollback system transaction', { error: String(rollbackErr) });
    }
    throw error;
  } finally {
    try {
      await client.query('RESET ALL');
    } catch {
      // Ignore cleanup error if connection was terminated
    }
    client.release();
  }
}

export async function runWithSessionOrSystem<T>(
  session: AuthenticatedUserSession | undefined,
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  if (session && session.staffId) {
    return withTransaction(session, callback);
  }
  return withSystemTransaction(callback);
}

/**
 * Executes a parameterized query within mandatory actor session context.
 */
export async function query<R extends QueryResultRow = any>(
  text: string,
  params: any[] = [],
  actorSession?: AuthenticatedUserSession
): Promise<QueryResult<R>> {
  return runWithSessionOrSystem(actorSession, (client) => client.query<R>(text, params));
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
