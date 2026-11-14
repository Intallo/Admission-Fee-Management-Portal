import fs from 'fs';
import path from 'path';
import { Pool, PoolClient } from 'pg';

export interface MigrationFile {
  filename: string;
  filepath: string;
  timestamp: string;
  isDown: boolean;
}

export interface MigrationExecutionResult {
  bootstrapApplied: boolean;
  migrationsApplied: string[];
  failedMigration?: string;
  error?: Error;
  durationMs: number;
}

export interface DatabaseVerificationReport {
  publicTableCount: number;
  privateTableCount: number;
  authTableCount: number;
  storageTableCount: number;
  rolesFound: string[];
  missingRoles: string[];
  rlsProtectedTableCount: number;
}

const REPO_ROOT = path.resolve(__dirname, '../../');
const MIGRATIONS_DIR = path.join(REPO_ROOT, 'supabase', 'migrations');
const BOOTSTRAP_FILE = path.join(REPO_ROOT, 'scripts', 'ci', '00_supabase_test_compat_bootstrap.sql');

export const REQUIRED_ROLES = [
  'anon',
  'authenticated',
  'service_role',
  'supabase_admin',
  'authenticator',
  'school_app_user',
  'school_app_login',
];

/**
 * Returns all forward migration files in strictly chronological order.
 */
export function getMigrationFiles(): MigrationFile[] {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    throw new Error(`Migrations directory does not exist: ${MIGRATIONS_DIR}`);
  }

  const entries = fs.readdirSync(MIGRATIONS_DIR);
  const files: MigrationFile[] = entries
    .filter((f) => f.endsWith('.sql'))
    .map((filename) => {
      const match = filename.match(/^(\d{14})_(.*?)(\.down)?\.sql$/);
      const timestamp = match ? match[1] : '';
      const isDown = filename.endsWith('.down.sql');
      return {
        filename,
        filepath: path.join(MIGRATIONS_DIR, filename),
        timestamp,
        isDown,
      };
    })
    .filter((m) => !m.isDown)
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  return files;
}

/**
 * Returns the path to the Supabase compatibility test bootstrap script.
 */
export function getBootstrapPath(): string {
  return BOOTSTRAP_FILE;
}

/**
 * Executes a raw SQL file using a PostgreSQL client.
 */
export async function executeSqlFile(client: PoolClient | Pool, filepath: string): Promise<void> {
  const sql = fs.readFileSync(filepath, 'utf-8');
  await client.query(sql);
}

/**
 * Executes the test bootstrap followed by all migrations in chronological order.
 * Fails immediately if any migration fails (stop immediately rule).
 */
export async function runMigrationSequence(
  client: PoolClient | Pool,
  options: { includeBootstrap?: boolean } = {}
): Promise<MigrationExecutionResult> {
  const startTime = Date.now();
  const includeBootstrap = options.includeBootstrap ?? true;
  const applied: string[] = [];

  try {
    if (includeBootstrap) {
      if (!fs.existsSync(BOOTSTRAP_FILE)) {
        throw new Error(`Bootstrap file not found: ${BOOTSTRAP_FILE}`);
      }
      await executeSqlFile(client, BOOTSTRAP_FILE);
    }

    const migrationFiles = getMigrationFiles();
    for (const migration of migrationFiles) {
      await executeSqlFile(client, migration.filepath);
      applied.push(migration.filename);
    }

    return {
      bootstrapApplied: includeBootstrap,
      migrationsApplied: applied,
      durationMs: Date.now() - startTime,
    };
  } catch (err: any) {
    return {
      bootstrapApplied: includeBootstrap,
      migrationsApplied: applied,
      failedMigration: applied.length < getMigrationFiles().length ? getMigrationFiles()[applied.length]?.filename : undefined,
      error: err,
      durationMs: Date.now() - startTime,
    };
  }
}

/**
 * Verifies that the required tables, schemas, roles, and RLS policies exist in the database.
 */
export async function verifyDatabaseState(client: PoolClient | Pool): Promise<DatabaseVerificationReport> {
  const publicRes = await client.query(
    "SELECT count(*)::int as cnt FROM information_schema.tables WHERE table_schema = 'public';"
  );
  const privateRes = await client.query(
    "SELECT count(*)::int as cnt FROM information_schema.tables WHERE table_schema = 'private';"
  );
  const authRes = await client.query(
    "SELECT count(*)::int as cnt FROM information_schema.tables WHERE table_schema = 'auth';"
  );
  const storageRes = await client.query(
    "SELECT count(*)::int as cnt FROM information_schema.tables WHERE table_schema = 'storage';"
  );
  const rolesRes = await client.query(
    'SELECT rolname FROM pg_roles WHERE rolname = ANY($1::text[]);',
    [REQUIRED_ROLES]
  );
  const rlsRes = await client.query(`
    SELECT count(*)::int as cnt
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity = true;
  `);

  const foundRoles = rolesRes.rows.map((r: any) => r.rolname);
  const missingRoles = REQUIRED_ROLES.filter((r) => !foundRoles.includes(r));

  return {
    publicTableCount: publicRes.rows[0]?.cnt || 0,
    privateTableCount: privateRes.rows[0]?.cnt || 0,
    authTableCount: authRes.rows[0]?.cnt || 0,
    storageTableCount: storageRes.rows[0]?.cnt || 0,
    rolesFound: foundRoles,
    missingRoles,
    rlsProtectedTableCount: rlsRes.rows[0]?.cnt || 0,
  };
}

if (
  typeof require !== 'undefined' &&
  (require.main === module || (typeof process !== 'undefined' && process.argv[1]?.includes('migration-runner')))
) {
  const isVerifyOnly = process.argv.includes('--verify-only');
  const dbUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgrespassword@localhost:5432/school_test_db';
  const pool = new Pool({ connectionString: dbUrl });

  const run = async () => {
    try {
      if (isVerifyOnly) {
        console.log(`==> Verifying database state against ${dbUrl} (--verify-only mode)...`);
      } else {
        console.log(`==> Applying and validating Supabase migrations against ${dbUrl}...`);
        const result = await runMigrationSequence(pool, { includeBootstrap: true });
        if (result.error) {
          console.error(`[MIGRATION ERROR] Failed on ${result.failedMigration}:`, result.error);
          await pool.end();
          process.exit(1);
        }
        console.log(`==> Successfully applied ${result.migrationsApplied.length} migrations in ${result.durationMs}ms`);
      }

      const report = await verifyDatabaseState(pool);
      console.log('==> Database Verification Report:');
      console.log(`    Public Tables:  ${report.publicTableCount}`);
      console.log(`    Private Tables: ${report.privateTableCount}`);
      console.log(`    Auth Tables:    ${report.authTableCount}`);
      console.log(`    Storage Tables: ${report.storageTableCount}`);
      console.log(`    RLS Protected:  ${report.rlsProtectedTableCount}`);

      if (report.missingRoles.length > 0) {
        console.error(`[ERROR] Missing required roles: ${report.missingRoles.join(', ')}`);
        await pool.end();
        process.exit(1);
      }

      if (report.publicTableCount === 0) {
        console.error('[ERROR] Database verification failed: no public tables found.');
        await pool.end();
        process.exit(1);
      }

      await pool.end();
      console.log('==> Migration validation completed successfully.');
      process.exit(0);
    } catch (err: any) {
      console.error('[FATAL ERROR]', err);
      await pool.end();
      process.exit(1);
    }
  };

  run();
}
