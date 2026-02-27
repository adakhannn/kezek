// apps/web/src/app/api/cron/analytics/hourly-load/route.ts
// Пересчёт часовой загрузки business_hourly_load на основе бронирований.

import { formatInTimeZone } from 'date-fns-tz';

import { withErrorHandler, createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { logDebug, logError } from '@/lib/log';
import { getServiceClient } from '@/lib/supabaseService';
import { getBusinessTimezone } from '@/lib/time';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const CRON_SECRET = process.env.CRON_SECRET || process.env.VERCEL_CRON_SECRET;

type HourlyCounters = {
  bookings_count: number;
  promo_bookings_count: number;
  staffIds: Set<string>;
  clientIds: Set<string>;
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

async function recalcHourlyForDate(supabase: ReturnType<typeof getServiceClient>, dateStr: string) {
  const dayStartIso = `${dateStr}T00:00:00Z`;
  const dayEndIso = `${dateStr}T23:59:59.999Z`;

  type Key = string;
  const byKey: Map<Key, HourlyCounters> = new Map();
  const bizTzMap: Map<string, string | null> = new Map();

  const ensure = (bizId: string, branchId: string, hour: number): HourlyCounters => {
    const key = `${bizId}::${branchId}::${hour}`;
    let entry = byKey.get(key);
    if (!entry) {
      entry = {
        bookings_count: 0,
        promo_bookings_count: 0,
        staffIds: new Set<string>(),
        clientIds: new Set<string>(),
      };
      byKey.set(key, entry);
    }
    return entry;
  };

  // 1) Загружаем успешные бронирования за день (по UTC-окну)
  const { data: bookingsRaw, error } = await supabase
    .from('bookings')
    .select('id,biz_id,branch_id,start_at,status,promotion_applied,client_id,staff_id')
    .gte('start_at', dayStartIso)
    .lte('start_at', dayEndIso)
    .in('status', ['confirmed', 'paid']);

  if (error) {
    logError('AnalyticsHourlyCron', 'Failed to load bookings', { date: dateStr, error: error.message });
    throw error;
  }

  const bookings = (bookingsRaw ?? []) as Array<{
    id: string;
    biz_id: string | null;
    branch_id: string | null;
    start_at: string;
    status: string;
    promotion_applied: unknown;
    client_id: string | null;
    staff_id: string | null;
  }>;

  if (bookings.length === 0) {
    return { date: dateStr, updated: 0 };
  }

  // 2) Получаем таймзоны бизнесов
  const bizIds = Array.from(
    new Set(
      bookings
        .map((b) => b.biz_id)
        .filter((id): id is string => !!id)
        .map((id) => String(id)),
    ),
  );

  if (bizIds.length > 0) {
    const { data: bizRowsRaw, error: bizErr } = await supabase
      .from('businesses')
      .select('id,tz')
      .in('id', bizIds);

    if (!bizErr && bizRowsRaw) {
      const bizRows = bizRowsRaw as Array<{ id: string; tz: string | null }>;
      bizRows.forEach((b) => {
        bizTzMap.set(String(b.id), b.tz ?? null);
      });
    } else if (bizErr) {
      logError('AnalyticsHourlyCron', 'Failed to load businesses for timezone', {
        date: dateStr,
        error: bizErr.message,
      });
    }
  }

  // 3) Агрегируем по локальной дате/часу в таймзоне бизнеса
  bookings.forEach((b) => {
    const bizId = b.biz_id ? String(b.biz_id) : null;
    const branchId = b.branch_id ? String(b.branch_id) : null;
    if (!bizId || !branchId) return;

    const tz = getBusinessTimezone(bizTzMap.get(bizId) ?? undefined);
    const start = new Date(b.start_at);

    const localDate = formatInTimeZone(start, tz, 'yyyy-MM-dd');
    if (localDate !== dateStr) {
      // Если локальная дата не совпадает с целевой — пропускаем (запись уйдет в соседний день при соответствующем запуске)
      return;
    }

    const hourStr = formatInTimeZone(start, tz, 'H');
    const hour = Number.parseInt(hourStr, 10);
    if (Number.isNaN(hour) || hour < 0 || hour > 23) return;

    const counters = ensure(bizId, branchId, hour);
    counters.bookings_count += 1;

    const promo = (b.promotion_applied ?? null) as {
      promotion_type?: string;
    } | null;
    if (promo && promo.promotion_type) {
      counters.promo_bookings_count += 1;
    }

    if (b.staff_id) {
      counters.staffIds.add(String(b.staff_id));
    }
    if (b.client_id) {
      counters.clientIds.add(String(b.client_id));
    }
  });

  if (byKey.size === 0) {
    return { date: dateStr, updated: 0 };
  }

  // 4) Upsert в business_hourly_load
  const nowIso = new Date().toISOString();
  const rows = Array.from(byKey.entries()).map(([key, c]) => {
    const [bizId, branchId, hourStr] = key.split('::');
    const hour = Number.parseInt(hourStr, 10);
    return {
      biz_id: bizId,
      branch_id: branchId,
      date: dateStr,
      hour,
      bookings_count: c.bookings_count,
      promo_bookings_count: c.promo_bookings_count,
      staff_count: c.staffIds.size || null,
      unique_clients_count: c.clientIds.size || null,
      updated_at: nowIso,
    };
  });

  const { error: upsertError } = await supabase
    .from('business_hourly_load')
    .upsert(rows, { onConflict: 'biz_id,branch_id,date,hour' });

  if (upsertError) {
    logError('AnalyticsHourlyCron', 'Failed to upsert business_hourly_load', {
      date: dateStr,
      error: upsertError.message,
    });
    throw upsertError;
  }

  return { date: dateStr, updated: rows.length };
}

async function handle(req: Request) {
  return withErrorHandler('AnalyticsHourlyCron', async () => {
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
      const res = await recalcHourlyForDate(supabase, d);
      results.push(res);
    }

    logDebug('AnalyticsHourlyCron', 'Completed hourly load aggregation', {
      days: results.length,
      range: days,
    });

    return createSuccessResponse({
      message: 'Analytics hourly load aggregation completed',
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

