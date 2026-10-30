import { z } from 'zod';

import { readGlobalOverviewForCaller } from '@/lib/adminGlobalOverviewReadService';
import { withErrorHandler, createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { addDaysToDateString, getTimezone, todayDateString } from '@/lib/time';
import { validateQuery } from '@/lib/validation/apiValidation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
});
const querySchema = z.object({ startDate: date.optional(), endDate: date.optional(), bizId: z.never().optional(), branchIds: z.never().optional() });

export async function GET(req: Request) {
  return withErrorHandler('AdminAnalyticsOverview', async () => {
    const query = validateQuery(new URL(req.url), querySchema);
    if (!query.success) return query.response;
    const tz = getTimezone();
    const end = query.data.endDate ?? todayDateString(tz);
    const start = query.data.startDate ?? addDaysToDateString(end, -30, tz);
    if (start > end) return createErrorResponse('validation', 'Дата начала позже даты окончания', undefined, 400);
    const result = await readGlobalOverviewForCaller(start, end);
    return result.ok ? createSuccessResponse(result.data) : createErrorResponse(result.error, result.message, undefined, result.status);
  });
}

