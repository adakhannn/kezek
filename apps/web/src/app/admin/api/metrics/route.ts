import { NextResponse } from 'next/server';
import { z } from 'zod';

import { logError, logDebug } from '@/lib/log';
import { getServiceClient } from '@/lib/supabaseService';
import { validateQuery } from '@/lib/validation/apiValidation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const metricsQuerySchema = z.object({
    endpoint: z.string().max(255).optional(),
    method: z.string().max(10).optional(),
    statusCode: z.coerce.number().int().min(100).max(599).optional(),
    startDate: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, 'startDate must be in YYYY-MM-DD format')
        .optional(),
    endDate: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, 'endDate must be in YYYY-MM-DD format')
        .optional(),
    limit: z.coerce.number().int().min(1).max(1000).optional().default(100),
    offset: z.coerce.number().int().min(0).optional().default(0),
    errorType: z.string().max(50).optional(),
    minDuration: z.coerce.number().int().min(0).optional(),
});

/**
 * GET /api/admin/metrics
 * Получает метрики API запросов с фильтрацией
 */
export async function GET(req: Request) {
    try {
        const url = new URL(req.url);
        const queryValidation = validateQuery(url, metricsQuerySchema);
        if (!queryValidation.success) {
            return queryValidation.response;
        }
        const params = queryValidation.data;

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
        if (params.statusCode !== undefined) {
            query = query.eq('status_code', params.statusCode);
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
        if (params.minDuration !== undefined) {
            query = query.gte('duration_ms', params.minDuration);
        }

        // Пагинация
        const limit = params.limit ?? 100;
        const offset = params.offset ?? 0;
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

