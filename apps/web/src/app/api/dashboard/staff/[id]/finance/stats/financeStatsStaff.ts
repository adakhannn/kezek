import { createErrorResponse } from '@/lib/apiErrorHandler';
import { logDebug, logError } from '@/lib/log';

type StaffFinanceStatsRow = {
    id: string;
    biz_id: string | null;
    full_name: string | null;
};

type SupabaseLikeClient = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    from: (table: string) => any;
};

export async function loadFinanceStatsStaff(
    supabase: SupabaseLikeClient,
    staffId: string,
    bizId: string
): Promise<StaffFinanceStatsRow | Response> {
    const { data: staff, error: staffError } = await supabase
        .from('staff')
        .select('id, biz_id, full_name')
        .eq('id', staffId)
        .maybeSingle();

    if (staffError) {
        logError('StaffFinanceStats', 'Error loading staff', {
            error: staffError.message,
            staffId,
            bizId,
        });
        return createErrorResponse('not_found', 'Сотрудник не найден или доступ запрещен', undefined, 404);
    }

    if (!staff) {
        logDebug('StaffFinanceStats', 'Staff not found', { staffId, bizId });
        return createErrorResponse('not_found', 'Сотрудник не найден или доступ запрещен', undefined, 404);
    }

    const normalizedBizId = bizId ? String(bizId).trim() : null;
    const normalizedStaffBizId = staff.biz_id != null ? String(staff.biz_id).trim() : null;

    if (!normalizedStaffBizId || !normalizedBizId || normalizedStaffBizId !== normalizedBizId) {
        logError('StaffFinanceStats', 'Staff business mismatch', {
            staffId,
            staffBizId: normalizedStaffBizId,
            requestedBizId: normalizedBizId,
            staffBizIdType: typeof staff.biz_id,
            bizIdType: typeof bizId,
        });
        return createErrorResponse('not_found', 'Сотрудник не найден или доступ запрещен', undefined, 404);
    }

    return staff;
}
