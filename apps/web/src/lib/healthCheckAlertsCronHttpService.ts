import { NextResponse } from 'next/server';

import { sendAlertEmail } from '@/lib/alerts';
import { createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { runHealthCheckAlerts } from '@/lib/healthCheckAlertsCronService';
import { logDebug } from '@/lib/log';

const CRON_SECRET = process.env.CRON_SECRET || process.env.VERCEL_CRON_SECRET;

export async function runHealthCheckAlertsCronHttp(req: Request): Promise<NextResponse> {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return createErrorResponse('auth', 'Не авторизован', undefined, 401);
  }

  logDebug('HealthCheckAlerts', 'Starting health check...');

  const { getServiceClient } = await import('@/lib/supabaseService');
  const { formatInTimeZone } = await import('date-fns-tz');
  const { TZ } = await import('@/lib/time');

  const result = await runHealthCheckAlerts({
    admin: getServiceClient() as never,
    formatDate: formatInTimeZone,
    tz: TZ,
    now: new Date(),
    sendAlertEmail,
  });

  if (!result.ok) {
    return createErrorResponse(result.error, result.message, result.details, result.status);
  }

  return createSuccessResponse(result.data);
}
