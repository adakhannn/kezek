import { NextResponse } from 'next/server';
import { z } from 'zod';

import { logError, logDebug } from '@/lib/log';
import { getServiceClient } from '@/lib/supabaseService';
import { createSupabaseServerClient } from '@/lib/supabaseHelpers';
import { withErrorHandler, createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { validateQuery } from '@/lib/validation/apiValidation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const analyticsQuerySchema = z.object({
    bizId: z.string().uuid().optional(),
    startDate: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, 'startDate must be in YYYY-MM-DD format')
        .optional(),
    endDate: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, 'endDate must be in YYYY-MM-DD format')
        .optional(),
    source: z.enum(['public', 'quickdesk']).optional(),
});

/**
 * GET /api/admin/funnel-analytics
 * Получает аналитику по конверсии воронки
 */
export async function GET(req: Request) {
    return withErrorHandler('FunnelAnalytics', async () => {
        const supabase = await createSupabaseServerClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return createErrorResponse('auth', 'Не авторизован', undefined, 401);
        }

        const url = new URL(req.url);
        const queryValidation = validateQuery(url, analyticsQuerySchema);
        if (!queryValidation.success) {
            return queryValidation.response;
        }

        const { bizId, startDate, endDate, source } = queryValidation.data;

        const serviceClient = getServiceClient();

        // Строим запрос для подсчета событий по типам
        let query = serviceClient
            .from('funnel_events')
            .select('event_type, source, session_id, created_at', { count: 'exact' });

        if (bizId) {
            query = query.eq('biz_id', bizId);
        }
        if (startDate) {
            query = query.gte('created_at', `${startDate}T00:00:00Z`);
        }
        if (endDate) {
            query = query.lte('created_at', `${endDate}T23:59:59Z`);
        }
        if (source) {
            query = query.eq('source', source);
        }

        const { data: events, error, count } = await query;

        if (error) {
            logError('FunnelAnalyticsAPI', 'Error fetching funnel events', { error: error.message });
            return NextResponse.json(
                { ok: false, error: error.message },
                { status: 500 }
            );
        }

        // Подсчитываем уникальные сессии для каждого шага воронки
        const steps = [
            'business_view',
            'branch_select',
            'service_select',
            'staff_select',
            'slot_select',
            'booking_success',
        ];

        const funnelData = steps.map((step, index) => {
            const stepEvents = events?.filter(e => e.event_type === step) || [];
            const uniqueSessions = new Set(stepEvents.map(e => e.session_id));
            const count = uniqueSessions.size;
            const totalEvents = stepEvents.length;

            // Вычисляем конверсию от предыдущего шага
            let conversionRate = 0;
            if (index > 0) {
                const prevStep = steps[index - 1];
                const prevStepEvents = events?.filter(e => e.event_type === prevStep) || [];
                const prevUniqueSessions = new Set(prevStepEvents.map(e => e.session_id));
                const prevCount = prevUniqueSessions.size;
                if (prevCount > 0) {
                    conversionRate = (count / prevCount) * 100;
                }
            }

            return {
                step,
                stepName: getStepName(step),
                uniqueSessions: count,
                totalEvents,
                conversionRate: Math.round(conversionRate * 100) / 100,
            };
        });

        // Общая конверсия (от просмотра бизнеса до успешной брони)
        const businessViews = events?.filter(e => e.event_type === 'business_view') || [];
        const bookingSuccesses = events?.filter(e => e.event_type === 'booking_success') || [];
        const totalViews = new Set(businessViews.map(e => e.session_id)).size;
        const totalBookings = new Set(bookingSuccesses.map(e => e.session_id)).size;
        const overallConversionRate = totalViews > 0 ? (totalBookings / totalViews) * 100 : 0;

        logDebug('FunnelAnalyticsAPI', 'Funnel analytics fetched', { 
            totalEvents: count,
            totalViews,
            totalBookings,
            overallConversionRate: Math.round(overallConversionRate * 100) / 100,
        });

        return createSuccessResponse({
            funnel: funnelData,
            summary: {
                totalViews,
                totalBookings,
                overallConversionRate: Math.round(overallConversionRate * 100) / 100,
                totalEvents: count || 0,
            },
        });
    });
}

function getStepName(step: string): string {
    const names: Record<string, string> = {
        business_view: 'Просмотр бизнеса',
        branch_select: 'Выбор филиала',
        service_select: 'Выбор услуги',
        staff_select: 'Выбор мастера',
        slot_select: 'Выбор слота',
        booking_success: 'Успешная бронь',
    };
    return names[step] || step;
}

