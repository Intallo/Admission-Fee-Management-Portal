import { createHmac, timingSafeEqual } from 'crypto';
import { StaffRole } from '../../modules/identity-access/types';
import { KNOWN_INSECURE_SECRETS } from '../env';

export const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes per US-01 AC4
export const MAX_SESSION_LIFETIME_MS = 8 * 60 * 60 * 1000; // 8 hours absolute max
export const SESSION_COOKIE_NAME = 'school_portal_session';
export const ACADEMIC_YEAR_COOKIE_NAME = 'school_portal_active_year';

export interface SessionPayload {
  sessionId: string;
  staffId: string;
  authUserId: string | null;
  email: string;
  fullName: string;
  role: StaffRole;
  isActive: boolean;
  activeAcademicYearId: string;
  activeAcademicYearLabel: string;
  mustChangePassword: boolean;
  createdAt: number;
  lastActivityAt: number;
  expiresAt: number;
}

export type TokenVerificationResult =
  | { valid: true; session: SessionPayload }
  | { valid: false; reason: 'INVALID_SIGNATURE' | 'MALFORMED' | 'SESSION_EXPIRED' | 'SESSION_IDLE_TIMEOUT' };

export function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'test') {
      return 'test-session-secret-32-character-minimum-string!';
    }
    throw new Error(
      '[SECURITY VIOLATION] SESSION_SECRET environment variable is missing. A dedicated 32+ character secret is required.'
    );
  }
  if (secret.length < 32) {
    throw new Error(
      '[SECURITY VIOLATION] SESSION_SECRET is too short. It must contain at least 32 cryptographically secure characters.'
    );
  }
  if (process.env.NODE_ENV === 'production' && KNOWN_INSECURE_SECRETS.includes(secret)) {
    throw new Error(
      '[SECURITY VIOLATION] Insecure or example SESSION_SECRET detected in production. Generate a dedicated cryptographically secure secret (e.g. openssl rand -hex 32).'
    );
  }
  return secret;
}

function base64UrlEncode(str: string): string {
  return Buffer.from(str)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64').toString('utf8');
}

/**
 * Creates a cryptographically signed session token.
 */
export function signSessionToken(payload: SessionPayload): string {
  const secret = getSessionSecret();
  const serialized = JSON.stringify(payload);
  const encodedPayload = base64UrlEncode(serialized);

  const hmac = createHmac('sha256', secret);
  hmac.update(encodedPayload);
  const signature = base64UrlEncode(hmac.digest('hex'));

  return `${encodedPayload}.${signature}`;
}

/**
 * Verifies the cryptographic signature, absolute expiration, and 30-minute idle timeout of a token.
 */
export function verifySessionToken(token: string, nowMs = Date.now()): TokenVerificationResult {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) {
      return { valid: false, reason: 'MALFORMED' };
    }

    const [encodedPayload, signature] = parts;
    const secret = getSessionSecret();

    // Verify HMAC
    const hmac = createHmac('sha256', secret);
    hmac.update(encodedPayload);
    const expectedSignature = base64UrlEncode(hmac.digest('hex'));

    const sigBuf = Buffer.from(signature);
    const expectedSigBuf = Buffer.from(expectedSignature);

    if (sigBuf.length !== expectedSigBuf.length || !timingSafeEqual(sigBuf, expectedSigBuf)) {
      return { valid: false, reason: 'INVALID_SIGNATURE' };
    }

    const jsonStr = base64UrlDecode(encodedPayload);
    const session = JSON.parse(jsonStr) as SessionPayload;

    // Check absolute expiration
    if (nowMs > session.expiresAt) {
      return { valid: false, reason: 'SESSION_EXPIRED' };
    }

    // Check 30-minute idle timeout (US-01 AC4)
    if (nowMs - session.lastActivityAt > IDLE_TIMEOUT_MS) {
      return { valid: false, reason: 'SESSION_IDLE_TIMEOUT' };
    }

    return { valid: true, session };
  } catch {
    return { valid: false, reason: 'MALFORMED' };
  }
}

/**
 * Updates the lastActivityAt timestamp on a valid session, extending its idle window.
 */
export function touchSession(session: SessionPayload, nowMs = Date.now()): SessionPayload {
  return {
    ...session,
    lastActivityAt: nowMs,
  };
}
