import { NextResponse } from 'next/server';
import { z } from 'zod';

import { logError, logDebug } from '@/lib/log';
import { getServiceClient } from '@/lib/supabaseService';
import { validateQuery } from '@/lib/validation/apiValidation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const financeLogsQuerySchema = z.object({
    staffId: z.string().uuid().optional(),
    bizId: z.string().uuid().optional(),
    shiftId: z.string().uuid().optional(),
    operationType: z.string().max(100).optional(),
    logLevel: z.enum(['info', 'warning', 'error']).optional(),
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
});

/**
 * GET /api/admin/finance-logs
 * Получает логи финансовых операций с фильтрацией
 */
export async function GET(req: Request) {
    try {
        const url = new URL(req.url);
        const queryValidation = validateQuery(url, financeLogsQuerySchema);
        if (!queryValidation.success) {
            return queryValidation.response;
        }
        const params = queryValidation.data;

        const serviceClient = getServiceClient();

        // Строим запрос с фильтрами
        let query = serviceClient
            .from('staff_finance_operation_logs')
            .select(`
                *,
                staff:staff_id(id, full_name),
                business:biz_id(id, name, slug)
            `, { count: 'exact' })
            .order('created_at', { ascending: false });

        // Фильтры
        if (params.staffId) {
            query = query.eq('staff_id', params.staffId);
        }
        if (params.bizId) {
            query = query.eq('biz_id', params.bizId);
        }
        if (params.shiftId) {
            query = query.eq('shift_id', params.shiftId);
        }
        if (params.operationType) {
            query = query.eq('operation_type', params.operationType);
        }
        if (params.logLevel) {
            query = query.eq('log_level', params.logLevel);
        }
        if (params.startDate) {
            query = query.gte('created_at', params.startDate);
        }
        if (params.endDate) {
            query = query.lte('created_at', params.endDate);
        }

        // Пагинация
        const limit = params.limit ?? 100;
        const offset = params.offset ?? 0;
        query = query.range(offset, offset + limit - 1);

        const { data, error, count } = await query;

        if (error) {
            logError('AdminFinanceLogsAPI', 'Error fetching logs', { error: error.message });
            return NextResponse.json(
                { ok: false, error: error.message },
                { status: 500 }
            );
        }

        logDebug('AdminFinanceLogsAPI', 'Logs fetched', { 
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
        logError('AdminFinanceLogsAPI', 'Unexpected error', { error });
        return NextResponse.json(
            { ok: false, error },
            { status: 500 }
        );
    }
}

