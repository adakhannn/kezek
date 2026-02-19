import { NextResponse } from 'next/server';
import { z } from 'zod';

import { logError, logDebug } from '@/lib/log';
import { getServiceClient } from '@/lib/supabaseService';
import { validateQuery } from '@/lib/validation/apiValidation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const statsQuerySchema = z.object({
    endpoint: z
        .string()
        .min(1)
        .max(255)
        .optional(),
    method: z
        .string()
        .min(1)
        .max(10)
        .optional(),
    windowMinutes: z.coerce.number().int().min(1).max(1440).optional().default(60),
});

/**
 * GET /api/admin/metrics/stats
 * Получает статистику по метрикам API запросов
 */
export async function GET(req: Request) {
    try {
        const url = new URL(req.url);
        const queryValidation = validateQuery(url, statsQuerySchema);
        if (!queryValidation.success) {
            return queryValidation.response;
        }
        const { endpoint, method, windowMinutes } = queryValidation.data;

        const serviceClient = getServiceClient();

        // Используем RPC функцию для получения статистики
        const effectiveWindowMinutes = windowMinutes ?? 60;
        const effectiveEndpoint = endpoint || '/api/staff/finance'; // Дефолтный endpoint

        const { data, error } = await serviceClient.rpc('get_api_metrics_stats', {
            p_endpoint: effectiveEndpoint,
            p_window_minutes: effectiveWindowMinutes,
            p_method: method || null,
        });

        if (error) {
            logError('AdminMetricsStatsAPI', 'Error fetching stats', { error: error.message });
            return NextResponse.json(
                { ok: false, error: error.message },
                { status: 500 }
            );
        }

        logDebug('AdminMetricsStatsAPI', 'Stats fetched', { 
            endpoint: effectiveEndpoint,
            windowMinutes: effectiveWindowMinutes,
            stats: data 
        });

        return NextResponse.json({
            ok: true,
            data: data || {},
        });
    } catch (e) {
        const error = e instanceof Error ? e.message : String(e);
        logError('AdminMetricsStatsAPI', 'Unexpected error', { error });
        return NextResponse.json(
            { ok: false, error },
            { status: 500 }
        );
    }
}

