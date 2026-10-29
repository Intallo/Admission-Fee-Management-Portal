import { NextResponse } from 'next/server';
import { getOrCreateCorrelationId } from '../../../lib/correlation';
import { getServerEnv, PROTECTED_REMOTE_REF } from '../../../lib/env';
import { logger } from '../../../lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const correlationId = getOrCreateCorrelationId(request.headers);
  const startTime = Date.now();

  try {
    const env = getServerEnv();

    const isTargetingRetainedRemote =
      env.NEXT_PUBLIC_SUPABASE_URL.includes(PROTECTED_REMOTE_REF) ||
      (env.DATABASE_URL ? env.DATABASE_URL.includes(PROTECTED_REMOTE_REF) : false);

    const healthStatus = {
      status: 'healthy',
      app: 'Admission & Fee Management Portal',
      version: '0.2.0',
      phase: 'Phase 2 Runnable Application Foundation',
      timestamp: new Date().toISOString(),
      correlationId,
      responseTimeMs: Date.now() - startTime,
      database: {
        safetyGuard: 'ACTIVE',
        targetType: env.NEXT_PUBLIC_SUPABASE_URL.includes('127.0.0.1') ? 'local_disposable' : 'configured_host',
        retainedRemoteProtected: !isTargetingRetainedRemote,
      },
      environment: {
        nodeEnv: env.NODE_ENV,
        publicUrlConfigured: Boolean(env.NEXT_PUBLIC_SUPABASE_URL),
        serviceRoleKeyConfigured: Boolean(env.SUPABASE_SERVICE_ROLE_KEY),
      },
    };

    logger.info('Health check verified', { correlationId, status: healthStatus.status });

    return NextResponse.json(healthStatus, {
      status: 200,
      headers: {
        'x-correlation-id': correlationId,
        'cache-control': 'no-store, max-age=0',
      },
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Health check failed', { correlationId }, err);

    return NextResponse.json(
      {
        status: 'unhealthy',
        correlationId,
        error: err.message,
        timestamp: new Date().toISOString(),
      },
      {
        status: 503,
        headers: {
          'x-correlation-id': correlationId,
          'cache-control': 'no-store, max-age=0',
        },
      }
    );
  }
}
