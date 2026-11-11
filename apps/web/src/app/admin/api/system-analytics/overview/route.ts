import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { z } from 'zod';

import { readAnalyticsSnapshot, reportFailure } from '@/lib/analyticsReportSnapshot';
import { withErrorHandler, createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { getSupabaseAnonKey, getSupabaseUrl } from '@/lib/env';
import { logError } from '@/lib/log';
import { getCached, setCached } from '@/lib/simpleCache';
import { getServiceClient } from '@/lib/supabaseService';
import { addDaysToDateString, getTimezone, todayDateString } from '@/lib/time';
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

    const tz = getTimezone();
    const endStr = endDate ?? todayDateString(tz);
    const startStr = startDate ?? addDaysToDateString(endStr, -30, tz);

    const cacheKey = `system_analytics_overview:${startStr}:${endStr}`;
    const cached = getCached<unknown>(cacheKey);
    if (cached) {
      return createSuccessResponse(cached);
    }

    const serviceClient = getServiceClient();

    let snapshot;
    try { snapshot = await readAnalyticsSnapshot(serviceClient, { startDate: startStr, endDate: endStr, kind: 'global' }); }
    catch (error) {
      const failure = reportFailure(error);
      return createErrorResponse(failure.error, failure.message, undefined, failure.status);
    }
    const sumCreated = snapshot.rows.reduce((sum, row) => sum + Number(row.bookings_created ?? 0), 0);
    const sumConfirmed = snapshot.rows.reduce((sum, row) => sum + Number(row.bookings_confirmed_or_paid ?? 0), 0);
    const sumRevenue = snapshot.rows.reduce((sum, row) => sum + Number(row.total_revenue ?? 0), 0);
    const avgCheck = sumConfirmed > 0 ? sumRevenue / sumConfirmed : 0;
    const byDay = snapshot.rows.map(row => ({ date: row.date, activeBusinesses: row.active_businesses,
      bookingsConfirmed: Number(row.bookings_confirmed_or_paid ?? 0), totalRevenue: Number(row.total_revenue ?? 0) }));

    const payload = {
      summary: {
        period: { startDate: startStr, endDate: endStr },
        activeBusinesses: snapshot.activeBusinesses,
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

