import { z } from 'zod';

import { withErrorHandler, createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { getBizContextForManagers } from '@/lib/authBiz';
import { getDashboardAnalyticsLoad } from '@/lib/dashboardAnalyticsLoadService';
import { getServiceClient } from '@/lib/supabaseService';
import { addDaysToDateString, getTimezone, todayDateString } from '@/lib/time';
import { validateQuery } from '@/lib/validation/apiValidation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const loadQuerySchema = z.object({
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
});

export async function GET(req: Request) {
  return withErrorHandler('AdminAnalyticsLoad', async () => {
    const { bizId: ctxBizId } = await getBizContextForManagers();
    const serviceClient = getServiceClient();

    const url = new URL(req.url);
    const queryValidation = validateQuery(url, loadQuerySchema);
    if (!queryValidation.success) {
      return queryValidation.response;
    }
    const { bizId, branchId, startDate, endDate } = queryValidation.data;

    const effectiveBizId = bizId ?? ctxBizId;
    if (bizId && bizId !== ctxBizId) {
      return createErrorResponse('forbidden', 'Access to this business is not allowed', undefined, 403);
    }

    const tz = getTimezone();
    const endStr = endDate ?? todayDateString(tz);
    const startStr = startDate ?? addDaysToDateString(endStr, -30, tz);

    const result = await getDashboardAnalyticsLoad({ admin: serviceClient, bizId: effectiveBizId, branchId, startDate: startStr, endDate: endStr });
    return result.ok ? createSuccessResponse(result.data) : createErrorResponse(result.error, result.message, undefined, result.status);
  });
}

