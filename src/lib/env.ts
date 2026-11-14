import { z } from 'zod';

export const PROTECTED_REMOTE_REF = 'fjrfyzamiirqzitdchkz';

export const KNOWN_INSECURE_SECRETS = [
  'dev-session-secret-must-be-at-least-32-chars-long!',
  '3de4c2eb6696cd73c84b7ef5ded86ab8fbd0325f073d9d895d03947a2096aed4',
  'generate-with-openssl-rand-hex-32-session-secret-placeholder',
  'generate-with-openssl-rand-hex-32-actor-secret-placeholder',
  'your-high-entropy-session-secret-here-at-least-32-characters',
  'your-high-entropy-actor-secret-here-at-least-32-characters',
];

/**
 * Public client environment schema (safe to expose to browser).
 * Only keys prefixed with NEXT_PUBLIC_ are included.
 */
export const clientEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z
    .string()
    .url('NEXT_PUBLIC_SUPABASE_URL must be a valid URL')
    .default('http://127.0.0.1:54321'),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z
    .string()
    .min(1, 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is required')
    .default('sb_publishable_local_dev_key'),
});

/**
 * Server-only environment schema.
 * Direct PostgreSQL pooling is the primary runtime persistence engine.
 * SUPABASE_SERVICE_ROLE_KEY is decoupled and optional for normal CRUD operations.
 */
export const serverEnvSchema = clientEnvSchema.extend({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  SESSION_SECRET: z
    .string()
    .min(32, 'SESSION_SECRET must be at least 32 characters')
    .optional(),
  ACTOR_SIGNING_SECRET: z
    .string()
    .min(32, 'ACTOR_SIGNING_SECRET must be at least 32 characters')
    .optional(),
  SUPABASE_SERVICE_ROLE_KEY: z
    .string()
    .min(1, 'SUPABASE_SERVICE_ROLE_KEY must be a valid key if provided')
    .optional(),
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
    SESSION_SECRET: process.env.SESSION_SECRET,
    ACTOR_SIGNING_SECRET: process.env.ACTOR_SIGNING_SECRET,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    DATABASE_URL: process.env.DATABASE_URL,
    ALLOW_REMOTE_DATABASE: process.env.ALLOW_REMOTE_DATABASE,
  });

  if (!parsed.success) {
    const errorDetails = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ');
    throw new Error(`[ENV CONFIG ERROR] Missing or invalid server environment: ${errorDetails}`);
  }

  if (parsed.data.NODE_ENV === 'production') {
    if (!parsed.data.SESSION_SECRET) {
      throw new Error('[ENV CONFIG ERROR] Missing required production environment variable: SESSION_SECRET (min 32 chars)');
    }
    if (!parsed.data.ACTOR_SIGNING_SECRET) {
      throw new Error('[ENV CONFIG ERROR] Missing required production environment variable: ACTOR_SIGNING_SECRET (min 32 chars)');
    }
    if (parsed.data.SESSION_SECRET === parsed.data.ACTOR_SIGNING_SECRET) {
      throw new Error('[SECURITY ERROR] SESSION_SECRET and ACTOR_SIGNING_SECRET must be dedicated, distinct secrets.');
    }
    if (KNOWN_INSECURE_SECRETS.includes(parsed.data.SESSION_SECRET)) {
      throw new Error(
        '[SECURITY ERROR] Insecure or example SESSION_SECRET detected in production. Generate a dedicated cryptographically secure secret (e.g. openssl rand -hex 32).'
      );
    }
    if (KNOWN_INSECURE_SECRETS.includes(parsed.data.ACTOR_SIGNING_SECRET)) {
      throw new Error(
        '[SECURITY ERROR] Insecure or example ACTOR_SIGNING_SECRET detected in production. Generate a dedicated cryptographically secure secret (e.g. openssl rand -hex 32).'
      );
    }
  }

  const allowRemote = parsed.data.ALLOW_REMOTE_DATABASE === 'true';
  assertSafeDatabaseTarget(parsed.data.NEXT_PUBLIC_SUPABASE_URL, parsed.data.DATABASE_URL, allowRemote);

  return parsed.data;
}
