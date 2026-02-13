import { NextResponse } from 'next/server';

import { logError, logDebug } from '@/lib/log';
import { getServiceClient } from '@/lib/supabaseService';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type MetricsQueryParams = {
    endpoint?: string;
    method?: string;
    statusCode?: string;
    startDate?: string;
    endDate?: string;
    limit?: string;
    offset?: string;
    errorType?: string;
    minDuration?: string;
};

/**
 * GET /api/admin/metrics
 * Получает метрики API запросов с фильтрацией
 */
export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const params: MetricsQueryParams = {
            endpoint: searchParams.get('endpoint') || undefined,
            method: searchParams.get('method') || undefined,
            statusCode: searchParams.get('statusCode') || undefined,
            startDate: searchParams.get('startDate') || undefined,
            endDate: searchParams.get('endDate') || undefined,
            limit: searchParams.get('limit') || '100',
            offset: searchParams.get('offset') || '0',
            errorType: searchParams.get('errorType') || undefined,
            minDuration: searchParams.get('minDuration') || undefined,
        };

        const serviceClient = getServiceClient();

        // Строим запрос с фильтрами
        let query = serviceClient
            .from('api_request_metrics')
            .select('*', { count: 'exact' })
            .order('created_at', { ascending: false });

        // Фильтры
        if (params.endpoint) {
            query = query.eq('endpoint', params.endpoint);
        }
        if (params.method) {
            query = query.eq('method', params.method);
        }
        if (params.statusCode) {
            query = query.eq('status_code', parseInt(params.statusCode, 10));
        }
        if (params.startDate) {
            query = query.gte('created_at', params.startDate);
        }
        if (params.endDate) {
            query = query.lte('created_at', params.endDate);
        }
        if (params.errorType) {
            query = query.eq('error_type', params.errorType);
        }
        if (params.minDuration) {
            query = query.gte('duration_ms', parseInt(params.minDuration, 10));
        }

        // Пагинация
        const limit = Math.min(parseInt(params.limit || '100', 10), 1000);
        const offset = parseInt(params.offset || '0', 10);
        query = query.range(offset, offset + limit - 1);

        const { data, error, count } = await query;

        if (error) {
            logError('AdminMetricsAPI', 'Error fetching metrics', { error: error.message });
            return NextResponse.json(
                { ok: false, error: error.message },
                { status: 500 }
            );
        }

        logDebug('AdminMetricsAPI', 'Metrics fetched', { 
            count: data?.length, 
            total: count,
            filters: params 
        });

        return NextResponse.json({
            ok: true,
            data: data || [],
            pagination: {
                total: count || 0,
                limit,
                offset,
                hasMore: (count || 0) > offset + limit,
            },
        });
    } catch (e) {
        const error = e instanceof Error ? e.message : String(e);
        logError('AdminMetricsAPI', 'Unexpected error', { error });
        return NextResponse.json(
            { ok: false, error },
            { status: 500 }
        );
    }
}

