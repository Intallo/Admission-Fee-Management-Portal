import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Pool } from 'pg';
import { PostgresAdmissionsRepository } from '../src/infrastructure/repositories/postgres/admissions.repository';
import { PostgresStudentRecordsRepository } from '../src/infrastructure/repositories/postgres/student-records.repository';
import { AuthenticatedUserSession } from '../src/modules/identity-access/types';

describe('Schema Alignment & STS Number Verification against Live PostgreSQL', () => {
  let pool: Pool;
  let admissionsRepo: PostgresAdmissionsRepository;
  let studentRecordsRepo: PostgresStudentRecordsRepository;

  const adminSession: AuthenticatedUserSession = {
    staffId: '11111111-1111-1111-1111-111111111111',
    authUserId: '11111111-1111-1111-1111-111111111111',
    role: 'system_admin',
    fullName: 'System Administrator',
    email: 'admin@school-demo.example',
    isActive: true,
    activeAcademicYearId: '00000000-0000-0000-0000-000000000001',
    activeAcademicYearLabel: '2026-27',
  };

  beforeAll(async () => {
    pool = new Pool({
      connectionString: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
    });
    admissionsRepo = new PostgresAdmissionsRepository();
    studentRecordsRepo = new PostgresStudentRecordsRepository();
  });

  afterAll(async () => {
    if (pool) {
      await pool.end();
    }
  });

  it('1. verifies sts_number and demographic columns exist on public.students', async () => {
    const res = await pool.query(`
      select column_name, data_type, is_nullable
      from information_schema.columns
      where table_schema = 'public' and table_name = 'students'
      order by column_name;
    `);
    const colNames = res.rows.map((r: any) => r.column_name);

    expect(colNames).toContain('sts_number');
    expect(colNames).toContain('dise_number');
    expect(colNames).toContain('dob');
    expect(colNames).toContain('date_of_birth');
    expect(colNames).toContain('nationality');
    expect(colNames).toContain('mother_tongue');
    expect(colNames).toContain('blood_group');
    expect(colNames).toContain('religion');
    expect(colNames).toContain('caste');
    expect(colNames).toContain('subcaste');
    expect(colNames).toContain('category');
    expect(colNames).toContain('transport_opted_in');
    expect(colNames).toContain('address_line1');
    expect(colNames).toContain('address_line_1');
    expect(colNames).toContain('pincode');
    expect(colNames).toContain('postal_code');
  });

  it('2. verifies fee_generated and override_missing_documents_reason exist on admission_applications', async () => {
    const res = await pool.query(`
      select column_name
      from information_schema.columns
      where table_schema = 'public' and table_name = 'admission_applications'
      order by column_name;
    `);
    const colNames = res.rows.map((r: any) => r.column_name);

    expect(colNames).toContain('fee_generated');
    expect(colNames).toContain('override_missing_documents_reason');
  });

  it('3. verifies synthetic demo students are populated with valid STS numbers', async () => {
    const res = await pool.query(`
      select first_name, last_name, sts_number, dise_number
      from public.students
      where email like '%@student-demo.example'
      order by email;
    `);
    expect(res.rows.length).toBeGreaterThan(0);
    for (const row of res.rows) {
      expect(row.sts_number).toMatch(/^STS-2026-\d{3}$/);
      expect(row.dise_number).toMatch(/^DISE-2901-\d{3}$/);
    }
  });

  it('4. executes admissionsRepo.getAllApplications without SQL error', async () => {
    const client = await pool.connect();
    try {
      const applications = await admissionsRepo.getAllApplications(adminSession, client);
      expect(Array.isArray(applications)).toBe(true);
      for (const app of applications) {
        expect(app).toHaveProperty('id');
        expect(app).toHaveProperty('student');
        expect(app.student).toHaveProperty('firstName');
        expect(app.student).toHaveProperty('lastName');
        expect(app.student).toHaveProperty('stsNumber');
        expect(app).toHaveProperty('feeGenerated');
      }
    } finally {
      client.release();
    }
  });

  it('5. executes studentRecordsRepo.searchStudents without SQL error', async () => {
    const client = await pool.connect();
    try {
      const results = await studentRecordsRepo.searchStudents({ search: 'Aarav' }, adminSession, client);
      expect(Array.isArray(results.data)).toBe(true);
      expect(results.total).toBeGreaterThan(0);
      expect(results.data[0].stsNumber).toBe('STS-2026-001');
    } finally {
      client.release();
    }
  });

  it('6. rejects invalid STS numbers failing the format check constraint', async () => {
    await expect(
      pool.query(`
        insert into public.students (first_name, last_name, sts_number)
        values ('Invalid', 'STS', 'bad')
      `)
    ).rejects.toThrow(/students_sts_number_format_chk/);
  });

  it('7. allows NULL sts_number for multiple new applications', async () => {
    const res1 = await pool.query(`
      insert into public.students (first_name, last_name, sts_number)
      values ('Temp', 'Student1', null)
      returning id, sts_number;
    `);
    const res2 = await pool.query(`
      insert into public.students (first_name, last_name, sts_number)
      values ('Temp', 'Student2', null)
      returning id, sts_number;
    `);

    expect(res1.rows[0].sts_number).toBeNull();
    expect(res2.rows[0].sts_number).toBeNull();
  });
});
