import { Pool } from 'pg';
import { randomUUID } from 'crypto';

const PROTECTED_REMOTE_REF = 'fjrfyzamiirqzitdchkz';
const DEFAULT_DEMO_HASH =
  'scrypt$16384$8$1$2b5c4d6dde398b0bf4670cb892ca6caf$ed8ee9d504f41d5925f48af8789655e2e9ff0151c6e21421264e2773a962c100433428607dd4ac3dab2f35c2918c6fd96719c3bfa891f7ad2801862df5e626eb';

async function bootstrapDemoAccounts() {
  const dbUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

  if (process.env.NODE_ENV === 'production') {
    throw new Error('[FATAL] Demo account bootstrapping is strictly forbidden in production!');
  }

  if (dbUrl.includes(PROTECTED_REMOTE_REF)) {
    throw new Error(`[FATAL] Demo account bootstrapping cannot target retained remote database (${PROTECTED_REMOTE_REF})!`);
  }

  const pool = new Pool({ connectionString: dbUrl });

  try {
    const client = await pool.connect();
    try {
      console.log('==> Connected to database for demo account bootstrapping...');

      const demoAccounts = [
        { email: 'system.admin@school-demo.example', role: 'system_admin', fullName: 'Demo System Administrator', mustChange: true },
        { email: 'principal@school-demo.example', role: 'principal', fullName: 'Demo Principal', mustChange: false },
        { email: 'admissions@school-demo.example', role: 'admission_officer', fullName: 'Demo Admission Officer', mustChange: false },
        { email: 'clerk@school-demo.example', role: 'clerk', fullName: 'Demo Clerk', mustChange: false },
        { email: 'accounts@school-demo.example', role: 'accountant', fullName: 'Demo Accountant', mustChange: false },
      ];

      await client.query('BEGIN');

      for (const acc of demoAccounts) {
        // Upsert staff member
        const staffRes = await client.query(
          `insert into public.staff_members (id, email, role, full_name, is_active, created_at, updated_at)
           values ($1, $2, $3, $4, true, now(), now())
           on conflict (email) do update
           set role = excluded.role, full_name = excluded.full_name, is_active = true, updated_at = now()
           returning id`,
          [randomUUID(), acc.email, acc.role, acc.fullName]
        );

        const staffId = staffRes.rows[0].id;

        // Upsert security profile with valid password hash
        await client.query(
          `insert into public.staff_security_profiles (staff_id, password_hash, must_change_password, failed_login_attempts, locked_until, updated_at)
           values ($1, $2, $3, 0, null, now())
           on conflict (staff_id) do update
           set password_hash = excluded.password_hash,
               must_change_password = excluded.must_change_password,
               failed_login_attempts = 0,
               locked_until = null,
               updated_at = now()`,
          [staffId, DEFAULT_DEMO_HASH, acc.mustChange]
        );

        console.log(`    Provisioned demo account: ${acc.email} (${acc.role})`);
      }

      await client.query('COMMIT');
      console.log('==> Successfully bootstrapped all demo accounts with security profiles.');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}

bootstrapDemoAccounts().catch((err) => {
  console.error('[BOOTSTRAP ERROR]', err);
  process.exit(1);
});
