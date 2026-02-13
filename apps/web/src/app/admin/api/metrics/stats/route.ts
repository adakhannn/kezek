import { NextResponse } from 'next/server';

import { logError, logDebug } from '@/lib/log';
import { getServiceClient } from '@/lib/supabaseService';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type StatsQueryParams = {
    endpoint?: string;
    method?: string;
    windowMinutes?: string;
};

/**
 * GET /api/admin/metrics/stats
 * Получает статистику по метрикам API запросов
 */
export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const params: StatsQueryParams = {
            endpoint: searchParams.get('endpoint') || undefined,
            method: searchParams.get('method') || undefined,
            windowMinutes: searchParams.get('windowMinutes') || '60',
        };

        const serviceClient = getServiceClient();

        // Используем RPC функцию для получения статистики
        const windowMinutes = parseInt(params.windowMinutes || '60', 10);
        const endpoint = params.endpoint || '/api/staff/finance'; // Дефолтный endpoint

        const { data, error } = await serviceClient.rpc('get_api_metrics_stats', {
            p_endpoint: endpoint,
            p_window_minutes: windowMinutes,
            p_method: params.method || null,
        });

        if (error) {
            logError('AdminMetricsStatsAPI', 'Error fetching stats', { error: error.message });
            return NextResponse.json(
                { ok: false, error: error.message },
                { status: 500 }
            );
        }

        logDebug('AdminMetricsStatsAPI', 'Stats fetched', { 
            endpoint,
            windowMinutes,
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

