import { NextResponse } from 'next/server';

import { createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { loadStaffFinanceAuditLog } from '@/lib/staffFinanceAuditLogService';
import { withManagerAndStaffContext } from '@/lib/withManagerAndStaffContext';

export async function runStaffFinanceAuditLogHttp(
    req: Request,
    context: unknown,
): Promise<NextResponse> {
    return withManagerAndStaffContext(
        req,
        context,
        { scope: 'FinanceAuditLog', staffIdParamName: 'id', staffSelect: 'id, biz_id' },
        async ({ admin, bizId, staffId }) => {
            const result = await loadStaffFinanceAuditLog({
                admin: admin as never,
                bizId,
                staffId,
            });

            if (!result.ok) {
                return createErrorResponse(result.error, result.message, undefined, result.status);
            }

            return createSuccessResponse({ entries: result.entries });
        },
    );
}
