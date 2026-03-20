import { createErrorResponse } from '@/lib/apiErrorHandler';
import { logDebug, logError } from '@/lib/log';

type OwnerShiftStaffRow = {
    id: string;
    biz_id: string | null;
    branch_id: string | null;
};

type SupabaseLikeClient = {
    from: (table: string) => {
        select: (columns: string) => {
            eq: (column: string, value: unknown) => {
                maybeSingle: () => Promise<{ data: OwnerShiftStaffRow | null; error: { message: string } | null }>;
            };
        };
    };
};

export async function loadOwnerShiftOpenStaff(
    supabase: SupabaseLikeClient,
    staffId: string,
    bizId: string
): Promise<OwnerShiftStaffRow | Response> {
    const { data: staff, error: staffError } = await supabase
        .from('staff')
        .select('id, biz_id, branch_id')
        .eq('id', staffId)
        .maybeSingle();

    if (staffError) {
        logError('OwnerShiftOpen', 'Error loading staff', {
            error: staffError.message,
            staffId,
            bizId,
        });
        return createErrorResponse('internal', 'Не удалось загрузить данные сотрудника', undefined, 500);
    }

    if (!staff) {
        return createErrorResponse('not_found', 'Сотрудник не найден', undefined, 404);
    }

    const normalizedBizId = bizId ? String(bizId).trim() : null;
    const normalizedStaffBizId = staff.biz_id != null ? String(staff.biz_id).trim() : null;

    if (!normalizedStaffBizId || !normalizedBizId || normalizedStaffBizId !== normalizedBizId) {
        logError('OwnerShiftOpen', 'Staff business mismatch', {
            staffId,
            staffBizId: normalizedStaffBizId,
            requestedBizId: normalizedBizId,
        });
        return createErrorResponse('forbidden', 'Сотрудник не принадлежит этому бизнесу', undefined, 403);
    }

    if (staff.branch_id == null) {
        logDebug('OwnerShiftOpen', 'Staff has no branch_id', { staffId, bizId });
        return createErrorResponse(
            'validation',
            'У сотрудника не указан филиал. Укажите филиал в карточке сотрудника и попробуйте снова.',
            undefined,
            400
        );
    }

    return staff;
}
