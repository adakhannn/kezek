import { withErrorHandler, createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { getBizContextForManagers } from '@/lib/authBiz';
import { checkResourceBelongsToBiz } from '@/lib/dbHelpers';
import { getRouteParamRequired } from '@/lib/routeParams';
import { createSupabaseAdminClient } from '@/lib/supabaseHelpers';
import { getServiceClient } from '@/lib/supabaseService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(_: Request, context: unknown) {
    return withErrorHandler('StaffRestore', async () => {
        const staffId = await getRouteParamRequired(context, 'id');
        const { bizId } = await getBizContextForManagers();
        const admin = getServiceClient();

    // 1) проверяем, что сотрудник принадлежит бизнесу (используем унифицированную утилиту)
    const staffCheck = await checkResourceBelongsToBiz<{ id: string; biz_id: string; user_id: string | null; is_active: boolean }>(
        admin,
        'staff',
        staffId,
        bizId,
        'id, biz_id, user_id, is_active'
    );
    if (staffCheck.error || !staffCheck.data) {
        return createErrorResponse('not_found', 'Сотрудник не найден', undefined, 404);
    }
    const staff = staffCheck.data;

    // 2) включаем карточку (используем service client)
    const { error: eUpd } = await admin
        .from('staff')
        .update({ is_active: true })
        .eq('id', staffId)
        .eq('biz_id', bizId);

    if (eUpd) {
        return createErrorResponse('validation', eUpd.message, undefined, 400);
    }

    // 3) вернём роль staff (если привязан к user_id)
    if (staff.user_id) {
        // Используем унифицированную утилиту для создания admin клиента
        const svc = createSupabaseAdminClient();

        const { data: roleStaff, error: eRole } = await svc
            .from('roles')
            .select('id')
            .eq('key', 'staff')
            .maybeSingle();

        if (eRole || !roleStaff?.id) {
            return createErrorResponse('internal', 'Роль staff не найдена', undefined, 500);
        }

        await svc
            .from('user_roles')
            .upsert(
                { user_id: staff.user_id, biz_id: bizId, role_id: roleStaff.id },
                { onConflict: 'user_id,role_id,biz_key' }
            );
    }

        return createSuccessResponse();
    });
}
