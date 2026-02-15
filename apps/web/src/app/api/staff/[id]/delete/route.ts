export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { createClient } from '@supabase/supabase-js';

import { createErrorResponse, createSuccessResponse, withErrorHandler } from '@/lib/apiErrorHandler';
import { getBizContextForManagers } from '@/lib/authBiz';
import { checkResourceBelongsToBiz } from '@/lib/dbHelpers';
import { getRouteParamUuid } from '@/lib/routeParams';
import { getServiceClient } from '@/lib/supabaseService';

export async function POST(_: Request, context: unknown) {
    return withErrorHandler('StaffDelete', async () => {
        // Валидация UUID для предотвращения потенциальных проблем безопасности
        const staffId = await getRouteParamUuid(context, 'id');
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
            return createErrorResponse('not_found', staffCheck.error || 'Сотрудник не найден', undefined, 404);
        }
        const staff = staffCheck.data;

        // 2) есть ли будущие активные записи?
        const nowIso = new Date().toISOString();
        const { count: futureBookingsCount, error: eBooks } = await admin
            .from('bookings')
            .select('id', { count: 'exact', head: true })
            .eq('biz_id', bizId)
            .eq('staff_id', staffId)
            .neq('status', 'cancelled')
            .gt('start_at', nowIso);

        if (eBooks) return createErrorResponse('internal', eBooks.message, undefined, 400);
        if ((futureBookingsCount ?? 0) > 0) {
            return createErrorResponse('conflict', 'Невозможно удалить сотрудника: у него есть будущие активные брони. Сначала отмените все будущие брони.', undefined, 409);
        }

        // 3) Удаляем все прошедшие брони (чтобы обойти FK-ограничения)
        const { error: eDelPastBookings } = await admin
            .from('bookings')
            .delete()
            .eq('biz_id', bizId)
            .eq('staff_id', staffId)
            .lt('start_at', nowIso);

        if (eDelPastBookings) {
            return createErrorResponse('internal', `Не удалось удалить прошедшие брони: ${eDelPastBookings.message}`, undefined, 400);
        }

        // 4) Удаляем расписание (working_hours)
        const { error: eDelWorkingHours } = await admin
            .from('working_hours')
            .delete()
            .eq('biz_id', bizId)
            .eq('staff_id', staffId);

        if (eDelWorkingHours) {
            return createErrorResponse('internal', `Не удалось удалить расписание: ${eDelWorkingHours.message}`, undefined, 400);
        }

        // 5) Удаляем связи с услугами (service_staff)
        const { error: eDelServiceStaff } = await admin
            .from('service_staff')
            .delete()
            .eq('staff_id', staffId);

        if (eDelServiceStaff) {
            return createErrorResponse('internal', `Не удалось удалить связи с услугами: ${eDelServiceStaff.message}`, undefined, 400);
        }

        // 6) Удаляем назначения на филиалы (staff_branch_assignments)
        const { error: eDelAssignments } = await admin
            .from('staff_branch_assignments')
            .delete()
            .eq('biz_id', bizId)
            .eq('staff_id', staffId);

        if (eDelAssignments) {
            return createErrorResponse('internal', `Не удалось удалить назначения на филиалы: ${eDelAssignments.message}`, undefined, 400);
        }

        // 7) Удаляем правила расписания (staff_schedule_rules)
        const { error: eDelRules } = await admin
            .from('staff_schedule_rules')
            .delete()
            .eq('biz_id', bizId)
            .eq('staff_id', staffId);

        if (eDelRules) {
            return createErrorResponse('internal', `Не удалось удалить правила расписания: ${eDelRules.message}`, undefined, 400);
        }

        // 8) Удаляем отпуска/выходные (staff_time_off)
        const { error: eDelTimeOff } = await admin
            .from('staff_time_off')
            .delete()
            .eq('biz_id', bizId)
            .eq('staff_id', staffId);

        if (eDelTimeOff) {
            return createErrorResponse('internal', `Не удалось удалить отпуска: ${eDelTimeOff.message}`, undefined, 400);
        }

        // 9) Если привязан к пользователю — понизить роли до client
        if (staff.user_id) {
            const svc = createClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.SUPABASE_SERVICE_ROLE_KEY!,
                { auth: { persistSession: false } }
            );

            const { data: roleClient, error: eRoleCli } = await svc
                .from('roles')
                .select('id')
                .eq('key', 'client')
                .maybeSingle();

            if (eRoleCli || !roleClient?.id) {
                return createErrorResponse('internal', 'Роль клиента не найдена', undefined, 500);
            }

            // Снимаем все бизнес-роли, кроме client
            const { error: eDelete } = await svc
                .from('user_roles')
                .delete()
                .eq('user_id', staff.user_id)
                .eq('biz_id', bizId)
                .neq('role_id', roleClient.id);

            if (eDelete) {
                return createErrorResponse('internal', eDelete.message, undefined, 400);
            }

            // Гарантируем, что client есть
            const { data: roleClientId } = await svc
                .from('roles')
                .select('id')
                .eq('key', 'client')
                .maybeSingle();

            await svc
                .from('user_roles')
                .upsert(
                    { user_id: staff.user_id, biz_id: bizId, role_id: roleClientId!.id },
                    { onConflict: 'user_id,role_id,biz_key' }
                );
        }

        // 10) Удаляем самого сотрудника
        const { error: eDelStaff } = await admin
            .from('staff')
            .delete()
            .eq('id', staffId)
            .eq('biz_id', bizId);

        if (eDelStaff) {
            return createErrorResponse('internal', eDelStaff.message, undefined, 400);
        }

        return createSuccessResponse();
    });
}

