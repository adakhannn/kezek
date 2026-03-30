import { z } from 'zod';

import { NextResponse } from 'next/server';

import { createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { getDashboardAnalyticsLoad } from '@/lib/dashboardAnalyticsLoadService';
import { getDashboardAnalyticsOverview } from '@/lib/dashboardAnalyticsOverviewService';
import { addDaysToDateString, getTimezone, todayDateString } from '@/lib/time';
import { validateQuery } from '@/lib/validation/apiValidation';
import { withManagerContext } from '@/lib/withManagerContext';

const overviewQuerySchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'startDate must be in YYYY-MM-DD format').optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'endDate must be in YYYY-MM-DD format').optional(),
});

const loadQuerySchema = z.object({
  branchId: z.string().uuid().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'startDate must be in YYYY-MM-DD format').optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'endDate must be in YYYY-MM-DD format').optional(),
});

export async function runDashboardAnalyticsOverviewHttp(req: Request): Promise<NextResponse> {
  return withManagerContext(req, 'DashboardAnalyticsOverview', async ({ bizId, admin }) => {
    const url = new URL(req.url);
    const queryValidation = validateQuery(url, overviewQuerySchema);
    if (!queryValidation.success) {
      return queryValidation.response;
    }

    const { startDate, endDate } = queryValidation.data;
    const tz = getTimezone();
    const endStr = endDate ?? todayDateString(tz);
    const startStr = startDate ?? addDaysToDateString(endStr, -30, tz);

    const result = await getDashboardAnalyticsOverview({
      admin: admin as never,
      bizId,
      startDate: startStr,
      endDate: endStr,
    });

    if (!result.ok) {
      return createErrorResponse(result.error, result.message, undefined, result.status);
    }

    return createSuccessResponse(result.data);
  });
}

export async function runDashboardAnalyticsLoadHttp(req: Request): Promise<NextResponse> {
  return withManagerContext(req, 'DashboardAnalyticsLoad', async ({ bizId, admin }) => {
    const url = new URL(req.url);
    const queryValidation = validateQuery(url, loadQuerySchema);
    if (!queryValidation.success) {
      return queryValidation.response;
    }

    const { branchId, startDate, endDate } = queryValidation.data;
    const tz = getTimezone();
    const endStr = endDate ?? todayDateString(tz);
    const startStr = startDate ?? addDaysToDateString(endStr, -30, tz);

    const result = await getDashboardAnalyticsLoad({
      admin: admin as never,
      bizId,
      branchId,
      startDate: startStr,
      endDate: endStr,
    });

    if (!result.ok) {
      return createErrorResponse(result.error, result.message, undefined, result.status);
    }

    return createSuccessResponse(result.data);
  });
}
