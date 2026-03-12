import type { NextResponse } from 'next/server';

import { createErrorResponse } from '@/lib/apiErrorHandler';
import { logError, logDebug } from '@/lib/log';
import { getRouteParamUuid } from '@/lib/routeParams';
import type { ManagerContext } from '@/lib/withManagerContext';
import { withManagerContext } from '@/lib/withManagerContext';

type StaffBaseRow = { id: string; biz_id: string | number | null };

export type ManagerAndStaffContext<TStaff extends StaffBaseRow> = ManagerContext & {
    staffId: string;
    staff: TStaff;
};

type Options = {
    scope: string;
    staffIdParamName?: string;
    /**
     * Supabase select string for staff row (must include id, biz_id).
     * If biz_id is missing, it will be appended.
     */
    staffSelect?: string;
    /**
     * Error message for 404 (avoid leaking staff IDs across businesses).
     */
    notFoundMessage?: string;
};

/**
 * Helper for dashboard API routes:
 * - resolves manager context (bizId/admin/supabase/userId)
 * - reads staffId from route params
 * - loads staff row and checks staff.biz_id === bizId (normalized)
 * - on failure returns 404 (not_found) to avoid leaking IDs across businesses
 */
export async function withManagerAndStaffContext<TStaff extends StaffBaseRow>(
    req: Request,
    context: unknown,
    opts: Options,
    handler: (ctx: ManagerAndStaffContext<TStaff>) => Promise<NextResponse>,
): Promise<NextResponse> {
    const scope = opts.scope;
    const staffIdParamName = opts.staffIdParamName ?? 'id';
    const staffId = await getRouteParamUuid(context, staffIdParamName);

    if (!staffId) {
        return createErrorResponse('validation', 'Отсутствует ID сотрудника', undefined, 400);
    }

    const notFoundMessage = opts.notFoundMessage ?? 'Сотрудник не найден или доступ запрещен';
    const staffSelectRaw = (opts.staffSelect ?? 'id, biz_id').trim();
    const staffSelect = staffSelectRaw.includes('biz_id') ? staffSelectRaw : `${staffSelectRaw}, biz_id`;

    return withManagerContext(req, scope, async ({ supabase, admin, bizId, userId }) => {
        const { data: staff, error: staffError } = await admin
            .from('staff')
            .select(staffSelect)
            .eq('id', staffId)
            .maybeSingle();

        if (staffError) {
            logError(scope, 'Error loading staff', { error: staffError.message, staffId, bizId });
            return createErrorResponse('not_found', notFoundMessage, undefined, 404);
        }

        if (!staff) {
            logDebug(scope, 'Staff not found', { staffId, bizId });
            return createErrorResponse('not_found', notFoundMessage, undefined, 404);
        }

        const normalizedBizId = bizId != null ? String(bizId).trim() : '';
        const staffRow = staff as unknown as StaffBaseRow;
        const normalizedStaffBizId = staffRow.biz_id != null ? String(staffRow.biz_id).trim() : '';

        if (!normalizedBizId || !normalizedStaffBizId || normalizedStaffBizId !== normalizedBizId) {
            logDebug(scope, 'Staff business mismatch (hidden as 404)', {
                staffId,
                staffBizId: normalizedStaffBizId,
                requestedBizId: normalizedBizId,
            });
            return createErrorResponse('not_found', notFoundMessage, undefined, 404);
        }

        return handler({
            supabase,
            admin,
            bizId,
            userId,
            staffId,
            staff: staff as unknown as TStaff,
        });
    });
}

