import { getOrCreateCorrelationId } from './correlation';

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

const SENSITIVE_KEYS = new Set([
  'password',
  'token',
  'access_token',
  'refresh_token',
  'authorization',
  'cookie',
  'set-cookie',
  'secret',
  'service_role_key',
  'supabase_service_role_key',
  'api_key',
  'apikey',
  'aadhaar',
  'aadhaar_number',
  'aadhaarnumber',
  'bank_account',
  'bank_account_number',
  'account_number',
  'ifsc',
  'ifsc_code',
  'database_url',
  'postgres_password',
  'household_income_inr',
  'caste_category',
]);

/**
 * Recursively redacts sensitive keys and values from logging context objects.
 */
export function redactSensitiveData(obj: unknown, depth = 0): unknown {
  if (depth > 6 || obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    // Redact JWT tokens if present in raw string
    if (obj.startsWith('Bearer ') || /^[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*$/.test(obj)) {
      return '[REDACTED_TOKEN]';
    }
    // Redact connection strings with passwords
    if (obj.includes('postgres://') || obj.includes('postgresql://')) {
      return obj.replace(/:\/\/[^:]+:[^@]+@/, '://[REDACTED_USER]:[REDACTED_PASSWORD]@');
    }
    // Redact 12-digit Aadhaar patterns
    if (/^\d{4}\s?\d{4}\s?\d{4}$/.test(obj)) {
      return '[REDACTED_AADHAAR]';
    }
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => redactSensitiveData(item, depth + 1));
  }

  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      const lowerKey = key.toLowerCase();
      if (SENSITIVE_KEYS.has(lowerKey) || lowerKey.includes('password') || lowerKey.includes('secret') || lowerKey.includes('token')) {
        result[key] = '[REDACTED]';
      } else {
        result[key] = redactSensitiveData(value, depth + 1);
      }
    }
    return result;
  }

  return obj;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  correlationId?: string;
  context?: Record<string, unknown>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

class StructuredLogger {
  private formatLog(level: LogLevel, message: string, context?: Record<string, unknown>, error?: Error): string {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      correlationId: (context?.correlationId as string) || undefined,
    };

    if (context) {
      const cleanContext = { ...context };
      delete cleanContext.correlationId;
      entry.context = redactSensitiveData(cleanContext) as Record<string, unknown>;
    }

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        // Include stack trace only in development or non-production
        stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined,
      };
    }

    return JSON.stringify(entry);
  }

  debug(message: string, context?: Record<string, unknown>): void {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(this.formatLog('DEBUG', message, context));
    }
  }

  info(message: string, context?: Record<string, unknown>): void {
    console.info(this.formatLog('INFO', message, context));
  }

  warn(message: string, context?: Record<string, unknown>, error?: Error): void {
    console.warn(this.formatLog('WARN', message, context, error));
  }

  error(message: string, context?: Record<string, unknown>, error?: Error): void {
    console.error(this.formatLog('ERROR', message, context, error));
  }
}

export const logger = new StructuredLogger();
