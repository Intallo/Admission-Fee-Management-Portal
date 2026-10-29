import { randomUUID } from 'crypto';

export const CORRELATION_HEADER_NAME = 'x-correlation-id';

/**
 * Extracts correlation ID from incoming request headers or generates a fresh UUID.
 */
export function getOrCreateCorrelationId(headers?: Headers | Record<string, string | string[] | undefined>): string {
  if (!headers) {
    return randomUUID();
  }

  if (typeof (headers as Headers).get === 'function') {
    const fromHeader = (headers as Headers).get(CORRELATION_HEADER_NAME);
    if (fromHeader && fromHeader.trim().length > 0) {
      return fromHeader.trim();
    }
  } else {
    const raw = (headers as Record<string, string | string[] | undefined>)[CORRELATION_HEADER_NAME];
    if (typeof raw === 'string' && raw.trim().length > 0) {
      return raw.trim();
    }
    if (Array.isArray(raw) && raw.length > 0 && typeof raw[0] === 'string' && raw[0].trim().length > 0) {
      return raw[0].trim();
    }
  }

  return randomUUID();
}
