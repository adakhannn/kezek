import { createErrorResponse } from '@/lib/apiErrorHandler';
import { checkResourceBelongsToBiz } from '@/lib/dbHelpers';

type AdminLikeClient = unknown;

export async function ensureFinanceAuditLogAccess(
    admin: AdminLikeClient,
    staffId: string | null,
    bizId: string
): Promise<{ staffId: string } | Response> {
    if (!staffId) {
        return createErrorResponse('validation', 'Отсутствует ID сотрудника', undefined, 400);
    }

    const staffCheck = await checkResourceBelongsToBiz<{ id: string; biz_id: string }>(
        admin as never,
        'staff',
        staffId,
        bizId,
        'id'
    );

    if (staffCheck.error || !staffCheck.data) {
        return createErrorResponse(
            'forbidden',
            staffCheck.error ?? 'Сотрудник не принадлежит этому бизнесу',
            undefined,
            403
        );
    }

    return { staffId };
}
