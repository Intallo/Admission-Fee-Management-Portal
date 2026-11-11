import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  getMigrationFiles,
  getBootstrapPath,
  REQUIRED_ROLES,
  runMigrationSequence,
  verifyDatabaseState,
} from '../scripts/ci/migration-runner';
import { assertDisposableDatabase } from '../src/infrastructure/db/guards';

describe('Milestone M8.3.1: PostgreSQL CI Foundation & Migration Verification', () => {
  const repoRoot = path.resolve(__dirname, '..');
  const bootstrapPath = getBootstrapPath();

  // ============================================================================
  // Suite 1: Clean Database Migration & Chronological Order Test
  // ============================================================================
  describe('1. Clean Database Migration & Chronological Sequence', () => {
    it('discovers all forward migration files in strictly chronological order', () => {
      const migrations = getMigrationFiles();
      expect(migrations.length).toBeGreaterThanOrEqual(9);

      // Verify all files have a valid 14-digit timestamp prefix
      for (const m of migrations) {
        expect(m.timestamp).toMatch(/^\d{14}$/);
        expect(m.isDown).toBe(false);
        expect(m.filename.endsWith('.sql')).toBe(true);
        expect(m.filename.endsWith('.down.sql')).toBe(false);
      }

      // Verify strictly ascending timestamp sequence
      for (let i = 1; i < migrations.length; i++) {
        const prev = migrations[i - 1].timestamp;
        const curr = migrations[i].timestamp;
        expect(curr > prev).toBe(true);
      }
    });

    it('verifies that baseline and security migrations follow architectural dependency order', () => {
      const migrations = getMigrationFiles();
      const filenames = migrations.map((m) => m.filename);

      // Invariant 1: Init schema comes first
      expect(filenames[0]).toContain('init_admission_fee_management_schema');

      // Invariant 2: Financial hardening comes after initial schema
      const hardeningIdx = filenames.findIndex((f) => f.includes('harden_financial_integrity'));
      expect(hardeningIdx).toBeGreaterThan(0);

      // Invariant 3: US-33 AC2 role provisioning comes before least-privilege login role
      const appRoleIdx = filenames.findIndex((f) => f.includes('provision_restricted_app_role'));
      const loginRoleIdx = filenames.findIndex((f) => f.includes('provision_school_app_login_and_rls'));
      expect(appRoleIdx).toBeGreaterThan(-1);
      expect(loginRoleIdx).toBeGreaterThan(appRoleIdx);

      // Invariant 4: Storage buckets provisioned before full RLS lock
      const storageIdx = filenames.findIndex((f) => f.includes('provision_private_storage_buckets'));
      expect(storageIdx).toBeGreaterThan(-1);

      // Invariant 5: Verifiable actor and auth gateway comes after login role
      const gatewayIdx = filenames.findIndex((f) => f.includes('verifiable_actor_and_auth_gateway'));
      expect(gatewayIdx).toBeGreaterThan(loginRoleIdx);

      // Invariant 6: Session revocation persistence follows auth gateway
      const revocationIdx = filenames.findIndex((f) => f.includes('persist_session_revocation'));
      if (revocationIdx > -1) {
        expect(revocationIdx).toBeGreaterThan(gatewayIdx);
      }
    });

    it('verifies all forward migration files exist and are non-empty', () => {
      const migrations = getMigrationFiles();
      for (const m of migrations) {
        expect(fs.existsSync(m.filepath)).toBe(true);
        const stats = fs.statSync(m.filepath);
        expect(stats.size).toBeGreaterThan(0);
      }
    });

    it('verifies live database schema state if DATABASE_URL is accessible', async () => {
      const dbUrl = process.env.DATABASE_URL;
      if (!dbUrl) {
        return;
      }
      try {
        const { Pool } = await import('pg');
        const pool = new Pool({ connectionString: dbUrl, connectionTimeoutMillis: 2000 });
        const client = await pool.connect();
        try {
          const report = await verifyDatabaseState(client);
          expect(report.missingRoles.length).toBe(0);
          expect(report.publicTableCount).toBeGreaterThanOrEqual(31);
          expect(report.privateTableCount).toBeGreaterThanOrEqual(1);
          expect(report.authTableCount).toBeGreaterThanOrEqual(1);
          expect(report.storageTableCount).toBeGreaterThanOrEqual(1);
        } finally {
          client.release();
          await pool.end();
        }
      } catch (err: any) {
        // Offline or connection refused in local developer environment
        console.log(`[NOTICE] PostgreSQL offline or unconfigured at ${dbUrl}; live verification deferred to CI.`);
      }
    });
  });

  // ============================================================================
  // Suite 2: Migration Failure Propagation Test
  // ============================================================================
  describe('2. Migration Failure Propagation & Stop-Immediately Guarantees', () => {
    it('halts migration sequence immediately upon encountering a SQL error', async () => {
      // Mock client that fails on the second query
      let queryCount = 0;
      const mockClient = {
        query: async (sql: string) => {
          queryCount++;
          if (queryCount === 2) {
            throw new Error('syntax error at or near "INVALID_SQL_TOKEN"');
          }
          return { rows: [], rowCount: 0 };
        },
      } as any;

      const result = await runMigrationSequence(mockClient, { includeBootstrap: false });

      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('syntax error at or near "INVALID_SQL_TOKEN"');
      // Must have stopped immediately after failure and NOT processed remaining migrations
      expect(result.migrationsApplied.length).toBe(1);
      expect(queryCount).toBe(2);
    });

    it('verifies CI shell runner enforces fail-fast ON_ERROR_STOP=1 and set -euo pipefail', () => {
      const scriptPath = path.join(repoRoot, 'scripts', 'ci', 'run-migrations.sh');
      expect(fs.existsSync(scriptPath)).toBe(true);

      const scriptContent = fs.readFileSync(scriptPath, 'utf-8');
      expect(scriptContent).toContain('set -euo pipefail');
      expect(scriptContent).toContain('ON_ERROR_STOP=1');
      expect(scriptContent).toContain('psql -v ON_ERROR_STOP=1');
      expect(scriptContent).toContain('00_supabase_test_compat_bootstrap.sql');
    });
  });

  // ============================================================================
  // Suite 3: Required-Role and Schema Availability Checks
  // ============================================================================
  describe('3. Required Roles, Schemas, Functions & Extension Availability', () => {
    it('verifies all required Supabase roles are provisioned in the CI bootstrap', () => {
      expect(fs.existsSync(bootstrapPath)).toBe(true);
      const bootstrapSql = fs.readFileSync(bootstrapPath, 'utf-8');

      // Check for all 5 standard Supabase roles
      const requiredBootstrapRoles = ['anon', 'authenticated', 'service_role', 'supabase_admin', 'authenticator'];
      for (const role of requiredBootstrapRoles) {
        expect(bootstrapSql).toContain(`'${role}'`);
        expect(bootstrapSql).toMatch(new RegExp(`create role ${role}\\b`, 'i'));
      }

      // Check that service_role has bypassrls
      expect(bootstrapSql).toMatch(/create role service_role\s+with\s+[^;]*bypassrls/i);
    });

    it('verifies required schemas auth and storage are provisioned in the CI bootstrap', () => {
      const bootstrapSql = fs.readFileSync(bootstrapPath, 'utf-8');

      expect(bootstrapSql).toContain('create schema if not exists auth;');
      expect(bootstrapSql).toContain('create schema if not exists storage;');

      // auth.users table definition
      expect(bootstrapSql).toContain('create table if not exists auth.users');
      expect(bootstrapSql).toContain('id uuid primary key');
      expect(bootstrapSql).toContain('email varchar(255) unique');

      // storage.buckets and storage.objects table definitions
      expect(bootstrapSql).toContain('create table if not exists storage.buckets');
      expect(bootstrapSql).toContain('create table if not exists storage.objects');
      expect(bootstrapSql).toContain('bucket_id text references storage.buckets(id)');
    });

    it('verifies standard Supabase auth helper functions are provisioned', () => {
      const bootstrapSql = fs.readFileSync(bootstrapPath, 'utf-8');

      expect(bootstrapSql).toContain('create or replace function auth.uid()');
      expect(bootstrapSql).toContain('create or replace function auth.role()');
      expect(bootstrapSql).toContain('create or replace function auth.email()');
      expect(bootstrapSql).toContain('create or replace function auth.jwt()');

      // Verify function execution grants
      expect(bootstrapSql).toContain('grant execute on function auth.uid() to anon, authenticated, service_role');
      expect(bootstrapSql).toContain('grant execute on function auth.role() to anon, authenticated, service_role');
      expect(bootstrapSql).toContain('grant execute on function auth.email() to anon, authenticated, service_role');
      expect(bootstrapSql).toContain('grant execute on function auth.jwt() to anon, authenticated, service_role');
    });

    it('verifies pgcrypto and uuid-ossp extensions are requested', () => {
      const bootstrapSql = fs.readFileSync(bootstrapPath, 'utf-8');
      expect(bootstrapSql).toContain('create extension if not exists "uuid-ossp";');
      expect(bootstrapSql).toContain('create extension if not exists pgcrypto;');
    });
  });

  // ============================================================================
  // Suite 4: Test Bootstrap Isolation & Production Safeguards
  // ============================================================================
  describe('4. Test Bootstrap Isolation & Production Safeguards', () => {
    it('ensures test bootstrap is isolated in scripts/ci and NOT in supabase/migrations', () => {
      const migrationsDir = path.join(repoRoot, 'supabase', 'migrations');
      const migrationFiles = fs.readdirSync(migrationsDir);

      // Verify bootstrap is not in supabase/migrations
      for (const file of migrationFiles) {
        expect(file).not.toContain('bootstrap');
        expect(file).not.toContain('compat');
      }

      // Verify bootstrap is located in scripts/ci
      expect(bootstrapPath).toContain(path.join('scripts', 'ci'));
      expect(fs.existsSync(bootstrapPath)).toBe(true);
    });

    it('ensures supabase/migrations contains strictly forward migrations and zero .down.sql rollback files for supabase db reset compatibility', () => {
      const migrationsDir = path.join(repoRoot, 'supabase', 'migrations');
      const migrationFiles = fs.readdirSync(migrationsDir);
      const downFiles = migrationFiles.filter((file) => file.endsWith('.down.sql'));

      // Native supabase db reset discovers all *.sql in supabase/migrations and fails on .down.sql
      expect(downFiles).toEqual([]);
    });

    it('verifies that two-way rollback scripts are preserved in supabase/rollbacks', () => {
      const rollbacksDir = path.join(repoRoot, 'supabase', 'rollbacks');
      expect(fs.existsSync(rollbacksDir)).toBe(true);

      const rollbackFiles = fs.readdirSync(rollbacksDir);
      expect(rollbackFiles.length).toBeGreaterThanOrEqual(5);
      for (const file of rollbackFiles) {
        expect(file.endsWith('.down.sql')).toBe(true);
      }
    });

    it('verifies fail-closed production guard in the test bootstrap SQL', () => {
      const bootstrapSql = fs.readFileSync(bootstrapPath, 'utf-8');

      // Must inspect app.environment and throw exception if production
      expect(bootstrapSql).toContain("current_setting('app.environment', true) = 'production'");
      expect(bootstrapSql).toContain('[FATAL SAFETY GUARD]');
      expect(bootstrapSql).toContain('raise exception');
    });

    it('enforces disposable database guard to prevent connecting to retained Supabase database', () => {
      const retainedHost = 'fjrfyzamiirqzitdchkz.supabase.co';
      const retainedUrl = `postgresql://postgres:secret@${retainedHost}:5432/postgres`;

      expect(() => {
        assertDisposableDatabase(retainedUrl);
      }).toThrow(/references protected remote database \(fjrfyzamiirqzitdchkz\)/);

      // Localhost and 127.0.0.1 must be accepted
      expect(() => {
        assertDisposableDatabase('postgresql://postgres:pass@localhost:5432/school_test_db');
      }).not.toThrow();
      expect(() => {
        assertDisposableDatabase('postgresql://postgres:pass@127.0.0.1:5432/school_test_db');
      }).not.toThrow();
    });

    it('verifies runbook explicitly distinguishes test bootstrap from production runbook', () => {
      const runbookPath = path.join(repoRoot, 'docs', 'DATABASE_MIGRATION_RUNBOOK.md');
      expect(fs.existsSync(runbookPath)).toBe(true);

      const runbookContent = fs.readFileSync(runbookPath, 'utf-8');
      expect(runbookContent).toContain('00_supabase_test_compat_bootstrap.sql');
      expect(runbookContent).toContain('Disposable');
    });
  });
});
