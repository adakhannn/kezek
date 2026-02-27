import { z } from 'zod';

import { withErrorHandler, createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { getBizContextForManagers } from '@/lib/authBiz';
import { logError } from '@/lib/log';
import { getCached, setCached } from '@/lib/simpleCache';
import { getServiceClient } from '@/lib/supabaseService';
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

    const end = endDate ? new Date(`${endDate}T00:00:00Z`) : new Date();
    const start =
      startDate && /^\d{4}-\d{2}-\d{2}$/.test(startDate)
        ? new Date(`${startDate}T00:00:00Z`)
        : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

    const startStr = start.toISOString().slice(0, 10);
    const endStr = end.toISOString().slice(0, 10);

    const cacheKey = `analytics_load:${effectiveBizId}:${branchId || 'all'}:${startStr}:${endStr}`;
    const cached = getCached<unknown>(cacheKey);
    if (cached) {
      return createSuccessResponse(cached);
    }

    let query = serviceClient
      .from('business_hourly_load')
      .select('biz_id,branch_id,date,hour,bookings_count,promo_bookings_count,staff_count,unique_clients_count')
      .eq('biz_id', effectiveBizId)
      .gte('date', startStr)
      .lte('date', endStr)
      .order('date', { ascending: true })
      .order('hour', { ascending: true });

    if (branchId) {
      query = query.eq('branch_id', branchId);
    }

    const { data, error } = await query;
    if (error) {
      logError('AdminAnalyticsLoad', 'Failed to load business_hourly_load', { error: error.message });
      return createErrorResponse('server', 'Failed to load hourly analytics', undefined, 500);
    }

    type BusinessHourlyRow = {
      date: string;
      hour: number;
      bookings_count: number | null;
      promo_bookings_count: number | null;
      staff_count: number | null;
      unique_clients_count: number | null;
    };

    const rows = (data ?? []) as BusinessHourlyRow[];

    const points = rows.map((r) => ({
      date: r.date,
      hour: r.hour,
      bookingsCount: r.bookings_count ?? 0,
      promoBookingsCount: r.promo_bookings_count ?? 0,
      staffCount: r.staff_count ?? null,
      uniqueClientsCount: r.unique_clients_count ?? null,
    }));

    const payload = {
      bizId: effectiveBizId,
      branchId: branchId ?? null,
      period: { startDate: startStr, endDate: endStr },
      points,
    };

    setCached(cacheKey, payload, 60_000);

    return createSuccessResponse(payload);
  });
}

