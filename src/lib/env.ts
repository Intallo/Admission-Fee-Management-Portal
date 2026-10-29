import { z } from 'zod';

export const PROTECTED_REMOTE_REF = 'fjrfyzamiirqzitdchkz';

/**
 * Public client environment schema (safe to expose to browser).
 * Only keys prefixed with NEXT_PUBLIC_ are included.
 */
export const clientEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z
    .string()
    .url('NEXT_PUBLIC_SUPABASE_URL must be a valid URL'),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z
    .string()
    .min(1, 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is required'),
});

/**
 * Server-only environment schema.
 * Includes privileged secrets that must NEVER leak to browser bundles.
 */
export const serverEnvSchema = clientEnvSchema.extend({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  SUPABASE_SERVICE_ROLE_KEY: z
    .string()
    .min(1, 'SUPABASE_SERVICE_ROLE_KEY is required on server runtime'),
  DATABASE_URL: z
    .string()
    .url('DATABASE_URL must be a valid postgres URL')
    .optional(),
  ALLOW_REMOTE_DATABASE: z
    .enum(['true', 'false'])
    .default('false')
    .optional(),
});

export type ClientEnv = z.infer<typeof clientEnvSchema>;
export type ServerEnv = z.infer<typeof serverEnvSchema>;

/**
 * Validates that environment does not point to the retained remote database during dev or tests.
 */
export function assertSafeDatabaseTarget(supabaseUrl?: string, databaseUrl?: string, allowRemote = false): void {
  const isDevOrTest = process.env.NODE_ENV !== 'production';

  const checkUrl = (url?: string, name?: string) => {
    if (!url) return;
    if (url.includes(PROTECTED_REMOTE_REF)) {
      throw new Error(
        `[DATABASE SAFETY GUARD] Connection to retained remote database (${PROTECTED_REMOTE_REF}) is STRICTLY FORBIDDEN in ${process.env.NODE_ENV || 'current'} environment. Target disposable local PostgreSQL instead.`
      );
    }
    if (isDevOrTest && !allowRemote && !url.includes('127.0.0.1') && !url.includes('localhost') && !url.includes('host.docker.internal')) {
      throw new Error(
        `[DATABASE SAFETY GUARD] Development and tests must run against disposable local database (127.0.0.1 / localhost). Remote target detected in ${name}: ${url}`
      );
    }
  };

  checkUrl(supabaseUrl, 'NEXT_PUBLIC_SUPABASE_URL');
  checkUrl(databaseUrl, 'DATABASE_URL');
}

/**
 * Validates client-side environment variables.
 */
export function getClientEnv(): ClientEnv {
  const parsed = clientEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });

  if (!parsed.success) {
    const errorDetails = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ');
    throw new Error(`[ENV CONFIG ERROR] Invalid client environment: ${errorDetails}`);
  }

  return parsed.data;
}

/**
 * Validates server-side environment variables with fail-closed security.
 */
export function getServerEnv(): ServerEnv {
  if (typeof window !== 'undefined') {
    throw new Error('[SECURITY VIOLATION] Attempted to access server environment variables from client bundle!');
  }

  const parsed = serverEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    NODE_ENV: process.env.NODE_ENV,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    DATABASE_URL: process.env.DATABASE_URL,
    ALLOW_REMOTE_DATABASE: process.env.ALLOW_REMOTE_DATABASE,
  });

  if (!parsed.success) {
    const errorDetails = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ');
    throw new Error(`[ENV CONFIG ERROR] Missing or invalid server environment: ${errorDetails}`);
  }

  const allowRemote = parsed.data.ALLOW_REMOTE_DATABASE === 'true';
  assertSafeDatabaseTarget(parsed.data.NEXT_PUBLIC_SUPABASE_URL, parsed.data.DATABASE_URL, allowRemote);

  return parsed.data;
}
