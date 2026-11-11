import { NextResponse } from 'next/server';


import { sendAlertEmail } from '@/lib/alerts';
import { createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { readBackgroundQueueHealth } from '@/lib/backgroundQueueHealth';
import { isAuthorizedCronRequest } from '@/lib/cronAuthorization';
import { readCronExecutionHealth } from '@/lib/cronExecutionHealth';
import { trackCronExecution } from '@/lib/cronExecutionTracking';
import { runHealthCheckAlerts } from '@/lib/healthCheckAlertsCronService';
import { logDebug } from '@/lib/log';

export async function runHealthCheckAlertsCronHttp(req: Request): Promise<NextResponse> {
  if (!isAuthorizedCronRequest(req, process.env.CRON_SECRET || process.env.VERCEL_CRON_SECRET)) {
    return createErrorResponse('auth', 'Не авторизован', undefined, 401);
  }

    return trackCronExecution('health-check-alerts', async () => {

  logDebug('HealthCheckAlerts', 'Starting health check...');

  const { getServiceClient } = await import('@/lib/supabaseService');
  const { formatInTimeZone } = await import('date-fns-tz');
  const { TZ } = await import('@/lib/time');

  const admin = getServiceClient();
  const [cronStatuses, queueStatuses] = await Promise.all([readCronExecutionHealth(admin), readBackgroundQueueHealth(admin)]);
  const result = await runHealthCheckAlerts({
    admin: admin as never,
    cronStatuses,
    queueStatuses,
    formatDate: formatInTimeZone,
    tz: TZ,
    now: new Date(),
    sendAlertEmail,
  });

  if (!result.ok) {
    return createErrorResponse(result.error, result.message, result.details, result.status);
  }

  return createSuccessResponse(result.data);
    });
}
