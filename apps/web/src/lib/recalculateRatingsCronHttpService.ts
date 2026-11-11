import { NextResponse } from 'next/server';


import { sendAlertEmail } from '@/lib/alerts';
import { createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { isAuthorizedCronRequest } from '@/lib/cronAuthorization';
import { trackCronExecution } from '@/lib/cronExecutionTracking';
import { measurePerformance } from '@/lib/performanceServer';
import { runRecalculateRatingsCron } from '@/lib/recalculateRatingsCronService';
import type { RecalculateRatingsSupabaseLike } from '@/lib/recalculateRatingsCronService';
import { getServiceClient } from '@/lib/supabaseService';
import { getTimezone, todayDateString } from '@/lib/time';

export async function runRecalculateRatingsCronHttp(req: Request): Promise<NextResponse> {
  if (!isAuthorizedCronRequest(req, process.env.CRON_SECRET || process.env.VERCEL_CRON_SECRET)) {
    return createErrorResponse('auth', 'Не авторизован', undefined, 401);
  }

    return trackCronExecution('recalculate-ratings', async () => {

  const result = await runRecalculateRatingsCron({
    supabase: getServiceClient() as unknown as RecalculateRatingsSupabaseLike,
    measurePerformance,
    sendAlertEmail,
    tz: getTimezone(),
    todayStr: todayDateString(getTimezone()),
  });

  if (!result.ok) {
    return createErrorResponse('internal', result.error, undefined, result.status);
  }

  return createSuccessResponse(result.data);
    });
}
