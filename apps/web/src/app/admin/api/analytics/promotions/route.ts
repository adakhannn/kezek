import { z } from 'zod';

import { readPromotionSnapshot, reportFailure } from '@/lib/analyticsReportSnapshot';
import { withErrorHandler, createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { getBizContextForManagers } from '@/lib/authBiz';
import { getCached, setCached } from '@/lib/simpleCache';
import { getServiceClient } from '@/lib/supabaseService';
import { addDaysToDateString, getTimezone, todayDateString } from '@/lib/time';
import { validateQuery } from '@/lib/validation/apiValidation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const promotionsQuerySchema = z.object({
  bizId: z.string().uuid().optional(),
  branchId: z.string().uuid().optional(),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'startDate must be in YYYY-MM-DD format')
    .optional(),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'endDate must be in YYYY-MM-DD format')
    .optional(),
  groupBy: z.enum(['type', 'day']).optional(),
});

export async function GET(req: Request) {
  return withErrorHandler('AdminAnalyticsPromotions', async () => {
    const { bizId: ctxBizId } = await getBizContextForManagers();
    const serviceClient = getServiceClient();

    const url = new URL(req.url);
    const queryValidation = validateQuery(url, promotionsQuerySchema);
    if (!queryValidation.success) {
      return queryValidation.response;
    }
    const { bizId, branchId, startDate, endDate, groupBy } = queryValidation.data;

    const effectiveBizId = bizId ?? ctxBizId;
    if (bizId && bizId !== ctxBizId) {
      return createErrorResponse('forbidden', 'Access to this business is not allowed', undefined, 403);
    }

    const tz = getTimezone();
    const endStr = endDate ?? todayDateString(tz);
    const startStr = startDate ?? addDaysToDateString(endStr, -30, tz);

    const cacheKey = `analytics_promotions:${effectiveBizId}:${branchId || 'all'}:${startStr}:${endStr}:${
      groupBy || 'none'
    }`;
    const cached = getCached<unknown>(cacheKey);
    if (cached) {
      return createSuccessResponse(cached);
    }

    let snapshot;
    try { snapshot = await readPromotionSnapshot(serviceClient, { bizId: effectiveBizId, branchId, startDate: startStr, endDate: endStr, timezone: tz }); }
    catch (error) {
      const failure = reportFailure(error);
      return createErrorResponse(failure.error, failure.message, undefined, failure.status);
    }

    const payload = {
      summary: snapshot.summary,
      byDay: groupBy === 'day' ? snapshot.byDay : undefined,
      byType: groupBy === 'type' ? snapshot.byType : undefined,
      period: { startDate: startStr, endDate: endStr },
    };

    setCached(cacheKey, payload, 60_000);

    return createSuccessResponse(payload);
  });
}

