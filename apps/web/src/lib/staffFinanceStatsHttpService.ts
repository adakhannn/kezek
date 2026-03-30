import { NextResponse } from 'next/server';

import { createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { runStaffFinanceStats } from '@/lib/staffFinanceStatsService';
import { withManagerAndStaffContext } from '@/lib/withManagerAndStaffContext';

export async function runStaffFinanceStatsHttp(
    req: Request,
    context: unknown,
): Promise<NextResponse> {
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
