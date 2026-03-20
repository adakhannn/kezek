import { createErrorResponse } from '@/lib/apiErrorHandler';
import { logDebug, logError } from '@/lib/log';

type FinanceByIdStaffRow = {
    id: string;
    biz_id: string | null;
    percent_master: number | null;
    percent_salon: number | null;
    hourly_rate: number | null;
};

type SupabaseLikeClient = {
    from: (table: string) => {
        select: (columns: string) => {
            eq: (column: string, value: unknown) => {
                maybeSingle: () => Promise<{ data: FinanceByIdStaffRow | null; error: { message: string } | null }>;
            };
        };
    };
};

export async function loadFinanceByIdStaff(
    supabase: SupabaseLikeClient,
    staffId: string,
    bizId: string
): Promise<FinanceByIdStaffRow | Response> {
    const { data: staff, error: staffError } = await supabase
        .from('staff')
        .select('id, biz_id, percent_master, percent_salon, hourly_rate')
        .eq('id', staffId)
        .maybeSingle();

    if (staffError) {
        logError('StaffFinance', 'Error loading staff', {
            error: staffError.message,
            staffId,
            bizId,
        });
        return createErrorResponse('not_found', 'Сотрудник не найден или доступ запрещен', undefined, 404);
    }

    if (!staff) {
        logDebug('StaffFinance', 'Staff not found', { staffId, bizId });
        return createErrorResponse('not_found', 'Сотрудник не найден или доступ запрещен', undefined, 404);
    }

    const normalizedBizId = bizId ? String(bizId).trim() : null;
    const normalizedStaffBizId = staff.biz_id != null ? String(staff.biz_id).trim() : null;

    if (!normalizedStaffBizId || !normalizedBizId || normalizedStaffBizId !== normalizedBizId) {
        logError('StaffFinance', 'Staff business mismatch', {
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
