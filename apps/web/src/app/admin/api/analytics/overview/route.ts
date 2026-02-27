import { z } from 'zod';

import { withErrorHandler, createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { getBizContextForManagers } from '@/lib/authBiz';
import { logError } from '@/lib/log';
import { getCached, setCached } from '@/lib/simpleCache';
import { getServiceClient } from '@/lib/supabaseService';
import { validateQuery } from '@/lib/validation/apiValidation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const overviewQuerySchema = z.object({
  bizId: z.string().uuid().optional(),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'startDate must be in YYYY-MM-DD format')
    .optional(),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'endDate must be in YYYY-MM-DD format')
    .optional(),
  branchIds: z.string().optional(),
});

export async function GET(req: Request) {
  return withErrorHandler('AdminAnalyticsOverview', async () => {
    const { bizId: ctxBizId } = await getBizContextForManagers();
    const serviceClient = getServiceClient();

    const url = new URL(req.url);
    const queryValidation = validateQuery(url, overviewQuerySchema);
    if (!queryValidation.success) {
      return queryValidation.response;
    }
    const { bizId, startDate, endDate, branchIds } = queryValidation.data;

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

    const cacheKey = `analytics_overview:${effectiveBizId}:${startStr}:${endStr}:${branchIds || ''}`;
    const cached = getCached<unknown>(cacheKey);
    if (cached) {
      return createSuccessResponse(cached);
    }

    let query = serviceClient
      .from('business_daily_stats')
      .select(
        'date,home_views,business_page_views,booking_flow_starts,bookings_created,bookings_confirmed_or_paid,promo_bookings,promo_revenue,total_revenue',
      )
      .eq('biz_id', effectiveBizId)
      .gte('date', startStr)
      .lte('date', endStr)
      .order('date', { ascending: true });

    if (branchIds && branchIds.trim()) {
      const ids = branchIds.split(',').map((s) => s.trim()).filter(Boolean);
      if (ids.length > 0) {
        query = query.in('branch_id', ids);
      }
    }

    const { data, error } = await query;
    if (error) {
      logError('AdminAnalyticsOverview', 'Failed to load business_daily_stats', { error: error.message });
      return createErrorResponse('server', 'Failed to load overview analytics', undefined, 500);
    }

    const rows = (data ?? []) as Array<{
      date: string;
      home_views: number | null;
      business_page_views: number | null;
      booking_flow_starts: number | null;
      bookings_created: number | null;
      bookings_confirmed_or_paid: number | null;
      promo_bookings: number | null;
      promo_revenue: number | null;
      total_revenue: number | null;
    }>;

    let sumHomeViews = 0;
    let sumBusinessViews = 0;
    let sumStarts = 0;
    let sumCreated = 0;
    let sumConfirmed = 0;
    let sumPromoBookings = 0;
    let sumPromoRevenue = 0;
    let sumTotalRevenue = 0;

    const byDay = rows.map((r) => {
      const home = r.home_views ?? 0;
      const bizViews = r.business_page_views ?? 0;
      const starts = r.booking_flow_starts ?? 0;
      const created = r.bookings_created ?? 0;
      const confirmed = r.bookings_confirmed_or_paid ?? 0;
      const promoB = r.promo_bookings ?? 0;
      const promoRev = r.promo_revenue ?? 0;
      const totalRev = r.total_revenue ?? 0;

      sumHomeViews += home;
      sumBusinessViews += bizViews;
      sumStarts += starts;
      sumCreated += created;
      sumConfirmed += confirmed;
      sumPromoBookings += promoB;
      sumPromoRevenue += promoRev;
      sumTotalRevenue += totalRev;

      return {
        date: r.date,
        homeViews: home,
        businessPageViews: bizViews,
        bookingFlowStarts: starts,
        bookingsCreated: created,
        bookingsConfirmedOrPaid: confirmed,
        promoBookings: promoB,
        promoRevenue: promoRev,
        totalRevenue: totalRev,
      };
    });

    const conversionHomeToBooking =
      sumHomeViews > 0 ? Math.round(((sumConfirmed / sumHomeViews) * 100 + Number.EPSILON) * 100) / 100 : 0;

    const payload = {
      summary: {
        period: { startDate: startStr, endDate: endStr },
        bookings: {
          created: sumCreated,
          confirmedOrPaid: sumConfirmed,
        },
        funnel: {
          homeViews: sumHomeViews,
          businessPageViews: sumBusinessViews,
          bookingFlowStarts: sumStarts,
          conversionHomeToBooking,
        },
        revenue: {
          total: sumTotalRevenue,
          promoBookings: sumPromoBookings,
          promoRevenue: sumPromoRevenue,
        },
      },
      byDay,
    };

    setCached(cacheKey, payload, 60_000);

    return createSuccessResponse(payload);
  });
}

