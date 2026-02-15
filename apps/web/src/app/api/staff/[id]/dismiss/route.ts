import { withErrorHandler, createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { getBizContextForManagers } from '@/lib/authBiz';
import { checkResourceBelongsToBiz } from '@/lib/dbHelpers';
import { getRouteParamRequired } from '@/lib/routeParams';
import { createSupabaseAdminClient } from '@/lib/supabaseHelpers';
import { getServiceClient } from '@/lib/supabaseService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(_: Request, context: unknown) {
    return withErrorHandler('StaffDismiss', async () => {
        const staffId = await getRouteParamRequired(context, 'id');
        const { bizId } = await getBizContextForManagers();
        const admin = getServiceClient();

    // 1) проверяем, что сотрудник принадлежит бизнесу (используем унифицированную утилиту)
    const staffCheck = await checkResourceBelongsToBiz<{ id: string; biz_id: string; user_id: string | null; is_active: boolean; full_name: string }>(
        admin,
        'staff',
        staffId,
        bizId,
        'id, biz_id, user_id, is_active, full_name'
    );
    if (staffCheck.error || !staffCheck.data) {
        return createErrorResponse('not_found', 'Сотрудник не найден', undefined, 404);
    }
    const staff = staffCheck.data;

    // 2) есть ли будущие активные записи?
    const nowIso = new Date().toISOString();
    const { count, error: eBooks } = await admin
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .eq('biz_id', bizId)
        .eq('staff_id', staffId)
        .neq('status', 'cancelled')
        .gt('start_at', nowIso);

    if (eBooks) {
        return createErrorResponse('validation', eBooks.message, undefined, 400);
    }
    if ((count ?? 0) > 0) {
        return createErrorResponse('conflict', 'У сотрудника есть будущие брони', undefined, 409);
    }

    // 3) деактивируем сотрудника (используем service client)
    const { error: eDeactivate } = await admin
        .from('staff')
        .update({ is_active: false })
        .eq('id', staffId)
        .eq('biz_id', bizId);

    if (eDeactivate) {
        return createErrorResponse('validation', eDeactivate.message, undefined, 400);
    }

    // 4) если привязан к пользователю — понизить роли до client
    if (staff.user_id) {
        // Используем унифицированную утилиту для создания admin клиента
        const svc = createSupabaseAdminClient();

        // найдём id роли client
        const { data: roleClient, error: eRoleCli } = await svc
            .from('roles')
            .select('id')
            .eq('key', 'client')
            .maybeSingle();

        if (eRoleCli || !roleClient?.id) {
            return createErrorResponse('internal', 'Роль client не найдена', undefined, 500);
        }

        // снимем все бизнес-роли, кроме client
        const { error: eDelete } = await svc
            .from('user_roles')
            .delete()
            .eq('user_id', staff.user_id)
            .eq('biz_id', bizId)
            .neq('role_id', roleClient.id);

        if (eDelete) {
            return createErrorResponse('validation', eDelete.message, undefined, 400);
        }

        // гарантируем, что client есть
        const { data: roleClientId } = await svc
            .from('roles')
            .select('id')
            .eq('key', 'client')
            .maybeSingle();

        await svc
            .from('user_roles')
            .upsert(
                { user_id: staff.user_id, biz_id: bizId, role_id: roleClientId!.id },
                { onConflict: 'user_id,role_id,biz_key' } // как мы стандартизировали
            );
    }

        return createSuccessResponse();
    });
}
