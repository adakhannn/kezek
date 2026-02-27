// apps/web/src/app/api/cron/analytics/daily/route.ts
// Пересчёт дневных агрегатов business_daily_stats на основе analytics_events + bookings.

import { withErrorHandler, createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { logDebug, logError } from '@/lib/log';
import { getServiceClient } from '@/lib/supabaseService';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const CRON_SECRET = process.env.CRON_SECRET || process.env.VERCEL_CRON_SECRET;

type DailyCounters = {
  home_views: number;
  business_page_views: number;
  booking_flow_starts: number;
  bookings_created: number;
  bookings_confirmed_or_paid: number;
  promo_bookings: number;
  promo_revenue: number;
  total_revenue: number;
};

function addDay(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function dateRange(start: Date, endInclusive: Date): string[] {
  const res: string[] = [];
  let cur = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
  const end = new Date(Date.UTC(endInclusive.getUTCFullYear(), endInclusive.getUTCMonth(), endInclusive.getUTCDate()));
  while (cur <= end) {
    res.push(cur.toISOString().slice(0, 10));
    cur = addDay(cur, 1);
  }
  return res;
}

async function recalcForDate(supabase: ReturnType<typeof getServiceClient>, dateStr: string) {
  const dayStartIso = `${dateStr}T00:00:00Z`;
  const dayEndIso = `${dateStr}T23:59:59.999Z`;

  const byBiz: Map<string, DailyCounters> = new Map();

  const ensure = (bizId: string): DailyCounters => {
    let entry = byBiz.get(bizId);
    if (!entry) {
      entry = {
        home_views: 0,
        business_page_views: 0,
        booking_flow_starts: 0,
        bookings_created: 0,
        bookings_confirmed_or_paid: 0,
        promo_bookings: 0,
        promo_revenue: 0,
        total_revenue: 0,
      };
      byBiz.set(bizId, entry);
    }
    return entry;
  };

  // 1) События воронки из analytics_events
  {
    const { data: eventsRaw, error } = await supabase
      .from('analytics_events')
      .select('biz_id,event_type,metadata')
      .gte('created_at', dayStartIso)
      .lte('created_at', dayEndIso);

    if (error) {
      logError('AnalyticsDailyCron', 'Failed to load analytics_events', { date: dateStr, error: error.message });
      throw error;
    }

    const events = (eventsRaw ?? []) as Array<{
      biz_id: string | null;
      event_type: string;
    }>;

    events.forEach((e) => {
      if (!e.biz_id) return;
      const counters = ensure(e.biz_id);
      switch (e.event_type) {
        case 'home_view':
          counters.home_views += 1;
          break;
        case 'business_page_view':
          counters.business_page_views += 1;
          break;
        case 'booking_flow_start':
          counters.booking_flow_starts += 1;
          break;
        case 'booking_created':
          counters.bookings_created += 1;
          break;
        case 'booking_confirmed_or_paid':
          counters.bookings_confirmed_or_paid += 1;
          break;
        default:
          break;
      }
    });
  }

  // 2) Брони и промо (по start_at)
  {
    const { data: bookingsRaw, error } = await supabase
      .from('bookings')
      .select('id,biz_id,status,promotion_applied,service_id')
      .gte('start_at', dayStartIso)
      .lte('start_at', dayEndIso);

    if (error) {
      logError('AnalyticsDailyCron', 'Failed to load bookings', { date: dateStr, error: error.message });
      throw error;
    }

    const bookings = (bookingsRaw ?? []) as Array<{
      biz_id: string | null;
      status: string;
      promotion_applied: unknown;
      service_id: string | null;
    }>;

    const successful = bookings.filter((b) => b.status === 'confirmed' || b.status === 'paid');

    if (successful.length > 0) {
      const serviceIds = Array.from(
        new Set(successful.map((b) => b.service_id).filter((id): id is string => !!id)),
      );

      const pricesByService = new Map<string, { price_from: number | null; price_to: number | null }>();
      if (serviceIds.length > 0) {
        const { data: servicesRaw, error: sErr } = await supabase
          .from('services')
          .select('id,price_from,price_to')
          .in('id', serviceIds);

        if (!sErr && servicesRaw) {
          const services = servicesRaw as Array<{
            id: string;
            price_from: number | null;
            price_to: number | null;
          }>;
          services.forEach((s) => {
            pricesByService.set(s.id, {
              price_from: s.price_from ?? null,
              price_to: s.price_to ?? null,
            });
          });
        } else if (sErr) {
          logError('AnalyticsDailyCron', 'Failed to load services for revenue estimation', {
            date: dateStr,
            error: sErr.message,
          });
        }
      }

      const getBasePrice = (serviceId: string | null | undefined): number => {
        if (!serviceId) return 0;
        const p = pricesByService.get(String(serviceId));
        if (!p) return 0;
        const from = typeof p.price_from === 'number' ? p.price_from : null;
        const to = typeof p.price_to === 'number' ? p.price_to : null;
        if (from !== null && to !== null) return (from + to) / 2;
        if (from !== null) return from;
        if (to !== null) return to;
        return 0;
      };

      successful.forEach((b) => {
        if (!b.biz_id) return;
        const counters = ensure(String(b.biz_id));
        // Промо
        const promo = (b.promotion_applied ?? null) as {
          promotion_type?: string;
          final_amount?: number | string | null;
          original_amount?: number | string | null;
        } | null;
        if (promo && promo.promotion_type) {
          const finalAmount =
            typeof promo.final_amount === 'number'
              ? promo.final_amount
              : Number(promo.final_amount ?? 0);
          counters.promo_bookings += 1;
          counters.promo_revenue += finalAmount;
          counters.total_revenue += finalAmount;
        } else {
          const base = getBasePrice(b.service_id);
          counters.total_revenue += base;
        }
      });
    }
  }

  // 3) Upsert в business_daily_stats
  if (byBiz.size === 0) {
    return { date: dateStr, updated: 0 };
  }

  const rows = Array.from(byBiz.entries()).map(([bizId, c]) => ({
    biz_id: bizId,
    date: dateStr,
    home_views: c.home_views,
    business_page_views: c.business_page_views,
    booking_flow_starts: c.booking_flow_starts,
    bookings_created: c.bookings_created,
    bookings_confirmed_or_paid: c.bookings_confirmed_or_paid,
    promo_bookings: c.promo_bookings,
    promo_revenue: c.promo_revenue,
    total_revenue: c.total_revenue,
    updated_at: new Date().toISOString(),
  }));

  const { error: upsertError } = await supabase
    .from('business_daily_stats')
    .upsert(rows, { onConflict: 'biz_id,date' });

  if (upsertError) {
    logError('AnalyticsDailyCron', 'Failed to upsert business_daily_stats', {
      date: dateStr,
      error: upsertError.message,
    });
    throw upsertError;
  }

  return { date: dateStr, updated: rows.length };
}

async function handle(req: Request) {
  return withErrorHandler('AnalyticsDailyCron', async () => {
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${CRON_SECRET}`) {
      return createErrorResponse('auth', 'Не авторизован', undefined, 401);
    }

    const url = new URL(req.url);
    const startParam = url.searchParams.get('startDate');
    const endParam = url.searchParams.get('endDate');

    const today = new Date();
    const yesterday = addDay(today, -1);

    const parseDate = (value: string | null, fallback: Date): Date => {
      if (!value) return fallback;
      const d = new Date(`${value}T00:00:00Z`);
      if (Number.isNaN(d.getTime())) return fallback;
      return d;
    };

    const startDate = parseDate(startParam, yesterday);
    const endDate = parseDate(endParam, yesterday);

    const supabase = getServiceClient();
    const days = dateRange(startDate, endDate);
    const results: Array<{ date: string; updated: number }> = [];

    for (const d of days) {
      const res = await recalcForDate(supabase, d);
      results.push(res);
    }

    logDebug('AnalyticsDailyCron', 'Completed daily analytics aggregation', {
      days: results.length,
      range: days,
    });

    return createSuccessResponse({
      message: 'Analytics daily aggregation completed',
      results,
    });
  });
}

export async function POST(req: Request) {
  return handle(req);
}

export async function GET(req: Request) {
  return handle(req);
}

