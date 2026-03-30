import { NextResponse } from 'next/server';

import { sendAlertEmail } from '@/lib/alerts';
import { createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { measurePerformance } from '@/lib/performance';
import { runRecalculateRatingsCron } from '@/lib/recalculateRatingsCronService';
import type { RecalculateRatingsSupabaseLike } from '@/lib/recalculateRatingsCronService';
import { getServiceClient } from '@/lib/supabaseService';
import { getTimezone, todayDateString } from '@/lib/time';

const CRON_SECRET = process.env.CRON_SECRET || process.env.VERCEL_CRON_SECRET;

export async function runRecalculateRatingsCronHttp(req: Request): Promise<NextResponse> {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return createErrorResponse('auth', 'Не авторизован', undefined, 401);
  }

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
}
