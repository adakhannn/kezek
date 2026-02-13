import { NextResponse } from 'next/server';

import { logError, logDebug } from '@/lib/log';
import { getServiceClient } from '@/lib/supabaseService';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type FinanceLogsQueryParams = {
    staffId?: string;
    bizId?: string;
    shiftId?: string;
    operationType?: string;
    logLevel?: string;
    startDate?: string;
    endDate?: string;
    limit?: string;
    offset?: string;
};

/**
 * GET /api/admin/finance-logs
 * Получает логи финансовых операций с фильтрацией
 */
export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const params: FinanceLogsQueryParams = {
            staffId: searchParams.get('staffId') || undefined,
            bizId: searchParams.get('bizId') || undefined,
            shiftId: searchParams.get('shiftId') || undefined,
            operationType: searchParams.get('operationType') || undefined,
            logLevel: searchParams.get('logLevel') || undefined,
            startDate: searchParams.get('startDate') || undefined,
            endDate: searchParams.get('endDate') || undefined,
            limit: searchParams.get('limit') || '100',
            offset: searchParams.get('offset') || '0',
        };

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
        const limit = Math.min(parseInt(params.limit || '100', 10), 1000);
        const offset = parseInt(params.offset || '0', 10);
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

