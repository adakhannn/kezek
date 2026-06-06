import { NextResponse } from 'next/server';

import { createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { getStaffContextForRequest } from '@/lib/authBiz';
import { getRouteParamUuid } from '@/lib/routeParams';
import { runStaffFinanceStats } from '@/lib/staffFinanceStatsService';
import { getServiceClient } from '@/lib/supabaseService';
import { withManagerAndStaffContext } from '@/lib/withManagerAndStaffContext';

export async function runStaffFinanceStatsHttp(
    req: Request,
    context: unknown,
): Promise<NextResponse> {
    if (req.headers.get('authorization')?.startsWith('Bearer ')) {
        return runSelfStaffFinanceStats(req, context);
    }

    return withManagerAndStaffContext<{
        id: string;
        biz_id: string | number | null;
        full_name: string | null;
    }>(
        req,
        context,
        { scope: 'StaffFinanceStats', staffIdParamName: 'id', staffSelect: 'id, biz_id, full_name' },
        async ({ admin, bizId, staffId, staff }) => {
            const result = await runStaffFinanceStats({
                req,
                admin,
                bizId,
                staffId,
                staff,
            });

            if (!result.ok) {
                return createErrorResponse(result.error, result.message, undefined, result.status);
            }

            return createSuccessResponse({ stats: result.stats });
        },
    );
}

async function runSelfStaffFinanceStats(req: Request, context: unknown): Promise<NextResponse> {
    try {
        const requestedStaffId = await getRouteParamUuid(context, 'id');
        if (!requestedStaffId) {
            return createErrorResponse('validation', 'Отсутствует ID сотрудника', undefined, 400);
        }

        const staffContext = await getStaffContextForRequest(req, 'StaffFinanceStats');
        if (requestedStaffId !== staffContext.staffId) {
            return createErrorResponse('forbidden', 'Доступ к статистике другого сотрудника запрещен', undefined, 403);
        }

        let admin = staffContext.supabase;
        try {
            admin = getServiceClient();
        } catch {}

        const { data: staff, error: staffError } = await admin
            .from('staff')
            .select('id, biz_id, full_name')
            .eq('id', staffContext.staffId)
            .eq('biz_id', staffContext.bizId)
            .maybeSingle();

        if (staffError || !staff) {
            return createErrorResponse('not_found', 'Сотрудник не найден', undefined, 404);
        }

        const result = await runStaffFinanceStats({
            req,
            admin,
            bizId: staffContext.bizId,
            staffId: staffContext.staffId,
            staff: { full_name: staff.full_name },
        });

        if (!result.ok) {
            return createErrorResponse(result.error, result.message, undefined, result.status);
        }

        return createSuccessResponse({ stats: result.stats });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'UNAUTHORIZED';
        const isAuthError =
            message === 'UNAUTHORIZED' ||
            message === 'NO_STAFF_RECORD' ||
            message.toLowerCase().includes('auth');

        return createErrorResponse(isAuthError ? 'auth' : 'internal', message, undefined, isAuthError ? 401 : 500);
    }
}
