import { z } from 'zod';

import { withErrorHandler, createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { getBizContextForManagers } from '@/lib/authBiz';
import { logError } from '@/lib/log';
import { getCached, setCached } from '@/lib/simpleCache';
import { getServiceClient } from '@/lib/supabaseService';
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

    const end = endDate ? new Date(`${endDate}T00:00:00Z`) : new Date();
    const start =
      startDate && /^\d{4}-\d{2}-\d{2}$/.test(startDate)
        ? new Date(`${startDate}T00:00:00Z`)
        : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

    const startStr = start.toISOString().slice(0, 10);
    const endStr = end.toISOString().slice(0, 10);

    const cacheKey = `analytics_promotions:${effectiveBizId}:${branchId || 'all'}:${startStr}:${endStr}:${
      groupBy || 'none'
    }`;
    const cached = getCached<unknown>(cacheKey);
    if (cached) {
      return createSuccessResponse(cached);
    }

    // 1) Сводка на основе business_daily_stats
    let dailyQuery = serviceClient
      .from('business_daily_stats')
      .select('date,promo_bookings,promo_revenue,total_revenue')
      .eq('biz_id', effectiveBizId)
      .gte('date', startStr)
      .lte('date', endStr);

    if (branchId) {
      dailyQuery = dailyQuery.eq('branch_id', branchId);
    }

    const { data: dailyRows, error: dailyError } = await dailyQuery;
    if (dailyError) {
      logError('AdminAnalyticsPromotions', 'Failed to load business_daily_stats', { error: dailyError.message });
      return createErrorResponse('server', 'Failed to load promotions summary', undefined, 500);
    }

    let promoBookings = 0;
    let promoRevenue = 0;
    let totalRevenue = 0;

    type DailyPromoRow = {
      date: string;
      promo_bookings: number | null;
      promo_revenue: number | null;
      total_revenue: number | null;
    };

    const dailyRowsTyped = (dailyRows ?? []) as DailyPromoRow[];

    const byDay =
      groupBy === 'day'
        ? dailyRowsTyped.map((r) => {
            const pb = r.promo_bookings ?? 0;
            const prev = r.promo_revenue ?? 0;
            const trev = r.total_revenue ?? 0;
            promoBookings += pb;
            promoRevenue += prev;
            totalRevenue += trev;
            return {
              date: r.date,
              promoBookings: pb,
              promoRevenue: prev,
              totalRevenue: trev,
            };
          })
        : dailyRowsTyped.forEach((r) => {
            promoBookings += r.promo_bookings ?? 0;
            promoRevenue += r.promo_revenue ?? 0;
            totalRevenue += r.total_revenue ?? 0;
          });

    // 2) Детализация по типам промо (если нужно)
    let byType: Array<{ promotionType: string; bookings: number; revenue: number; discountGiven: number }> | undefined;
    if (groupBy === 'type') {
      let bookingsQuery = serviceClient
        .from('bookings')
        .select('promotion_applied')
        .eq('biz_id', effectiveBizId)
        .gte('start_at', `${startStr}T00:00:00Z`)
        .lte('start_at', `${endStr}T23:59:59.999Z`)
        .in('status', ['confirmed', 'paid']);

      if (branchId) {
        bookingsQuery = bookingsQuery.eq('branch_id', branchId);
      }

      const { data: bookingsRows, error: bookingsError } = await bookingsQuery;
      if (bookingsError) {
        logError('AdminAnalyticsPromotions', 'Failed to load bookings for type breakdown', {
          error: bookingsError.message,
        });
      } else {
        const map = new Map<string, { bookings: number; revenue: number; discount: number }>();

        type BookingPromoRow = {
          promotion_applied: unknown;
        };

        const bookingsTyped = (bookingsRows ?? []) as BookingPromoRow[];

        bookingsTyped.forEach((b) => {
          const promo = (b.promotion_applied ?? null) as {
            promotion_type?: string;
            original_amount?: number | string | null;
            final_amount?: number | string | null;
          } | null;
          if (!promo || !promo.promotion_type) return;
          const type = String(promo.promotion_type);
          const base = Number(promo.original_amount ?? 0);
          const final = Number(promo.final_amount ?? 0);
          const discount = base - final;
          const entry = map.get(type) ?? { bookings: 0, revenue: 0, discount: 0 };
          entry.bookings += 1;
          entry.revenue += final;
          entry.discount += discount > 0 ? discount : 0;
          map.set(type, entry);
        });
        byType = Array.from(map.entries()).map(([type, v]) => ({
          promotionType: type,
          bookings: v.bookings,
          revenue: v.revenue,
          discountGiven: v.discount,
        }));
      }
    }

    const payload = {
      summary: {
        promoBookings,
        promoRevenue,
        totalRevenue,
      },
      byDay: groupBy === 'day' ? byDay : undefined,
      byType,
      period: { startDate: startStr, endDate: endStr },
    };

    setCached(cacheKey, payload, 60_000);

    return createSuccessResponse(payload);
  });
}

