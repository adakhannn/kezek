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
  return withErrorHandler('DashboardAnalyticsOverview', async () => {
    const { bizId } = await getBizContextForManagers();
    const serviceClient = getServiceClient();

    const url = new URL(req.url);
    const queryValidation = validateQuery(url, overviewQuerySchema);
    if (!queryValidation.success) {
      return queryValidation.response;
    }
    const { startDate, endDate } = queryValidation.data;

    const end = endDate ? new Date(`${endDate}T00:00:00Z`) : new Date();
    const start =
      startDate && /^\d{4}-\d{2}-\d{2}$/.test(startDate)
        ? new Date(`${startDate}T00:00:00Z`)
        : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

    const startStr = start.toISOString().slice(0, 10);
    const endStr = end.toISOString().slice(0, 10);

    const cacheKey = `dashboard_analytics_overview:${bizId}:${startStr}:${endStr}`;
    const cached = getCached<unknown>(cacheKey);
    if (cached) {
      return createSuccessResponse(cached);
    }

    const { data, error } = await serviceClient
      .from('business_daily_stats')
      .select(
        'date,home_views,business_page_views,booking_flow_starts,bookings_created,bookings_confirmed_or_paid,promo_bookings,promo_revenue,total_revenue',
      )
      .eq('biz_id', bizId)
      .gte('date', startStr)
      .lte('date', endStr)
      .order('date', { ascending: true });
    if (error) {
      logError('DashboardAnalyticsOverview', 'Failed to load business_daily_stats', { error: error.message });
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

