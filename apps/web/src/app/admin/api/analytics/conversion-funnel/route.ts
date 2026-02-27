import { z } from 'zod';

import { withErrorHandler, createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { getBizContextForManagers } from '@/lib/authBiz';
import { logError } from '@/lib/log';
import { getCached, setCached } from '@/lib/simpleCache';
import { getServiceClient } from '@/lib/supabaseService';
import { validateQuery } from '@/lib/validation/apiValidation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const funnelQuerySchema = z.object({
  bizId: z.string().uuid().optional(),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'startDate must be in YYYY-MM-DD format')
    .optional(),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'endDate must be in YYYY-MM-DD format')
    .optional(),
  source: z.enum(['web', 'mobile']).optional(),
});

export async function GET(req: Request) {
  return withErrorHandler('AdminAnalyticsFunnel', async () => {
    const { bizId: ctxBizId } = await getBizContextForManagers();
    const serviceClient = getServiceClient();

    const url = new URL(req.url);
    const queryValidation = validateQuery(url, funnelQuerySchema);
    if (!queryValidation.success) {
      return queryValidation.response;
    }
    const { bizId, startDate, endDate, source } = queryValidation.data;

    const effectiveBizId = bizId ?? ctxBizId;
    if (bizId && bizId !== ctxBizId) {
      return createErrorResponse('forbidden', 'Access to this business is not allowed', undefined, 403);
    }

    const end = endDate ? new Date(`${endDate}T00:00:00Z`) : new Date();
    const start =
      startDate && /^\d{4}-\d{2}-\d{2}$/.test(startDate)
        ? new Date(`${startDate}T00:00:00Z`)
        : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

    const startIso = start.toISOString();
    const endIso = end.toISOString();

    const cacheKey = `analytics_funnel:${effectiveBizId}:${startIso}:${endIso}:${source || 'all'}`;
    const cached = getCached<unknown>(cacheKey);
    if (cached) {
      return createSuccessResponse(cached);
    }

    let query = serviceClient
      .from('analytics_events')
      .select('event_type,source,session_id')
      .eq('biz_id', effectiveBizId)
      .gte('created_at', startIso)
      .lte('created_at', endIso);

    if (source) {
      query = query.eq('source', source);
    }

    const { data, error } = await query;
    if (error) {
      logError('AdminAnalyticsFunnel', 'Failed to load analytics_events', { error: error.message });
      return createErrorResponse('server', 'Failed to load funnel analytics', undefined, 500);
    }

    const events = (data ?? []) as Array<{ event_type: string; source: string; session_id: string | null }>;

    const stepsOrder = [
      'home_view',
      'business_page_view',
      'booking_flow_start',
      'booking_created',
      'booking_confirmed_or_paid',
    ] as const;

    type StepId = (typeof stepsOrder)[number];

    const sessionsByStep: Record<StepId, Set<string>> = {
      home_view: new Set(),
      business_page_view: new Set(),
      booking_flow_start: new Set(),
      booking_created: new Set(),
      booking_confirmed_or_paid: new Set(),
    };

    events.forEach((e) => {
      const sid = e.session_id || '';
      if (!sid) return;
      if ((stepsOrder as readonly string[]).includes(e.event_type)) {
        sessionsByStep[e.event_type as StepId].add(sid);
      }
    });

    const steps = stepsOrder.map((id, index) => {
      const current = sessionsByStep[id].size;
      let conversionFromPrev: number | null = null;
      if (index > 0) {
        const prevId = stepsOrder[index - 1];
        const prev = sessionsByStep[prevId].size;
        conversionFromPrev = prev > 0 ? Math.round(((current / prev) * 100 + Number.EPSILON) * 100) / 100 : 0;
      }
      const labels: Record<StepId, string> = {
        home_view: 'Просмотры главной',
        business_page_view: 'Просмотры бизнеса',
        booking_flow_start: 'Начали бронировать',
        booking_created: 'Создали бронь',
        booking_confirmed_or_paid: 'Успешная бронь',
      };
      return {
        id,
        label: labels[id],
        sessions: current,
        conversionFromPrev,
      };
    });

    const totalHome = sessionsByStep.home_view.size;
    const totalSuccess = sessionsByStep.booking_confirmed_or_paid.size;
    const overallConversion =
      totalHome > 0 ? Math.round(((totalSuccess / totalHome) * 100 + Number.EPSILON) * 100) / 100 : 0;

    const payload = {
      steps,
      overallConversion,
      period: {
        startDate: start.toISOString().slice(0, 10),
        endDate: end.toISOString().slice(0, 10),
      },
    };

    setCached(cacheKey, payload, 60_000);

    return createSuccessResponse(payload);
  });
}

