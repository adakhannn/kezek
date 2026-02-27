import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { z } from 'zod';

import { withErrorHandler, createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { getSupabaseAnonKey, getSupabaseUrl } from '@/lib/env';
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

async function ensureSuperAdmin() {
  const url = getSupabaseUrl();
  const anon = getSupabaseAnonKey();
  const cookieStore = await cookies();

  const supabase = createServerClient(url, anon, {
    cookies: {
      get: (name: string) => cookieStore.get(name)?.value,
      set: () => {},
      remove: () => {},
    },
  });

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error('UNAUTHORIZED');
  }

  const { data: isSuper, error: rpcError } = await supabase.rpc('is_super_admin');
  if (rpcError) {
    logError('SystemAnalyticsOverview', 'is_super_admin RPC failed', {
      error: rpcError.message,
      code: rpcError.code,
    });
  }

  if (!isSuper) {
    throw new Error('FORBIDDEN_SUPER_ADMIN_ONLY');
  }
}

export async function GET(req: Request) {
  return withErrorHandler('SystemAnalyticsOverview', async () => {
    await ensureSuperAdmin();

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

    const cacheKey = `system_analytics_overview:${startStr}:${endStr}`;
    const cached = getCached<unknown>(cacheKey);
    if (cached) {
      return createSuccessResponse(cached);
    }

    const serviceClient = getServiceClient();

    const { data, error } = await serviceClient
      .from('business_daily_stats')
      .select('biz_id,date,bookings_created,bookings_confirmed_or_paid,total_revenue')
      .gte('date', startStr)
      .lte('date', endStr);

    if (error) {
      logError('SystemAnalyticsOverview', 'Failed to load business_daily_stats', { error: error.message });
      return createErrorResponse('server', 'Failed to load system overview analytics', undefined, 500);
    }

    type Row = {
      biz_id: string | null;
      date: string;
      bookings_created: number | null;
      bookings_confirmed_or_paid: number | null;
      total_revenue: number | null;
    };

    const rows = (data ?? []) as Row[];

    const uniqueBizIds = new Set<string>();
    const byDate = new Map<
      string,
      { activeBizIds: Set<string>; bookingsConfirmed: number; totalRevenue: number }
    >();

    let sumCreated = 0;
    let sumConfirmed = 0;
    let sumRevenue = 0;

    rows.forEach((r) => {
      const bizId = r.biz_id ? String(r.biz_id) : null;
      if (bizId) {
        uniqueBizIds.add(bizId);
      }

      const created = r.bookings_created ?? 0;
      const confirmed = r.bookings_confirmed_or_paid ?? 0;
      const revenue = Number(r.total_revenue ?? 0);

      sumCreated += created;
      sumConfirmed += confirmed;
      sumRevenue += revenue;

      const entry =
        byDate.get(r.date) ??
        ((): { activeBizIds: Set<string>; bookingsConfirmed: number; totalRevenue: number } => {
          const e = { activeBizIds: new Set<string>(), bookingsConfirmed: 0, totalRevenue: 0 };
          byDate.set(r.date, e);
          return e;
        })();

      if (bizId) {
        entry.activeBizIds.add(bizId);
      }
      entry.bookingsConfirmed += confirmed;
      entry.totalRevenue += revenue;
    });

    const avgCheck = sumConfirmed > 0 ? sumRevenue / sumConfirmed : 0;

    const byDay = Array.from(byDate.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, v]) => ({
        date,
        activeBusinesses: v.activeBizIds.size,
        bookingsConfirmed: v.bookingsConfirmed,
        totalRevenue: v.totalRevenue,
      }));

    const payload = {
      summary: {
        period: { startDate: startStr, endDate: endStr },
        activeBusinesses: uniqueBizIds.size,
        bookings: {
          created: sumCreated,
          confirmed: sumConfirmed,
        },
        revenue: {
          total: sumRevenue,
          avgCheck,
        },
      },
      byDay,
    };

    setCached(cacheKey, payload, 60_000);

    return createSuccessResponse(payload);
  });
}

