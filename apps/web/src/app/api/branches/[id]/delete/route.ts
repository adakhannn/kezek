export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { createErrorResponse, createSuccessResponse, withErrorHandler } from '@/lib/apiErrorHandler';
import { getBizContextForManagers } from '@/lib/authBiz';
import { checkResourceBelongsToBiz } from '@/lib/dbHelpers';
import { logWarn } from '@/lib/log';
import { getRouteParamUuid } from '@/lib/routeParams';
import { getServiceClient } from '@/lib/supabaseService';

export async function POST(_req: Request, context: unknown) {
    return withErrorHandler('BranchesDelete', async () => {
        // Валидация UUID для предотвращения потенциальных проблем безопасности
        const branchId = await getRouteParamUuid(context, 'id');
        const { supabase, bizId } = await getBizContextForManagers();
        
        // Проверяем, является ли пользователь суперадмином
        const { data: isSuper } = await supabase.rpc('is_super_admin');
        if (!isSuper) {
            return createErrorResponse('forbidden', 'Только суперадмин может удалять филиалы', undefined, 403);
        }
        
        const admin = getServiceClient();

        // 1) филиал наш? (используем унифицированную утилиту)
        const branchCheck = await checkResourceBelongsToBiz<{ id: string; biz_id: string }>(
            admin,
            'branches',
            branchId,
            bizId,
            'id, biz_id'
        );
        if (branchCheck.error || !branchCheck.data) {
            return createErrorResponse('validation', branchCheck.error || 'Филиал не принадлежит этому бизнесу', undefined, 400);
        }

        // 2) нет активных услуг?
        // Неактивные услуги (мягко удаленные) не должны блокировать удаление филиала
        const { count: servicesCount } = await admin
            .from('services')
            .select('id', { count: 'exact', head: true })
            .eq('biz_id', bizId)
            .eq('branch_id', branchId)
            .eq('active', true); // Только активные услуги

        if ((servicesCount ?? 0) > 0) {
            return createErrorResponse('conflict', 'Невозможно удалить филиал: к нему привязаны активные услуги. Сначала удалите или переместите все активные услуги.', undefined, 400);
        }

        // 3) нет активных сотрудников?
        // Неактивные (уволенные) сотрудники не должны блокировать удаление филиала
        const { count: staffCount } = await admin
            .from('staff')
            .select('id', { count: 'exact', head: true })
            .eq('biz_id', bizId)
            .eq('branch_id', branchId)
            .eq('is_active', true); // Только активные сотрудники

        if ((staffCount ?? 0) > 0) {
            return createErrorResponse('conflict', 'Невозможно удалить филиал: к нему привязаны активные сотрудники. Сначала удалите или переместите всех активных сотрудников.', undefined, 400);
        }

        // 4) нет активных (неотмененных) броней, привязанных к этому филиалу?
        // Отмененные брони не должны блокировать удаление филиала
        const { data: activeBookings, count: activeBookingsCount } = await admin
            .from('bookings')
            .select('id,status,start_at,client_name,service_id', { count: 'exact' })
            .eq('biz_id', bizId)
            .eq('branch_id', branchId)
            .neq('status', 'cancelled') // Исключаем отмененные
            .limit(10);

        if ((activeBookingsCount ?? 0) > 0) {
            return createErrorResponse('conflict', 'Невозможно удалить филиал: к нему привязаны активные (неотмененные) брони. Сначала отмените или удалите все активные брони.', {
                total: activeBookingsCount ?? 0,
                active: activeBookingsCount ?? 0,
                cancelled: 0,
                bookings: activeBookings?.slice(0, 5) || [],
            }, 400);
        }

        // 5) Обрабатываем неактивных сотрудников - перемещаем их в другой филиал
        // или игнорируем, если нет других филиалов (неактивные не должны блокировать удаление)
        const { data: otherBranch } = await admin
            .from('branches')
            .select('id')
            .eq('biz_id', bizId)
            .neq('id', branchId)
            .eq('is_active', true)
            .limit(1)
            .maybeSingle();

        if (otherBranch) {
            // Перемещаем неактивных сотрудников в другой филиал
            const { error: eMoveStaff } = await admin
                .from('staff')
                .update({ branch_id: otherBranch.id })
                .eq('biz_id', bizId)
                .eq('branch_id', branchId)
                .eq('is_active', false);

            if (eMoveStaff) {
                // Если не удалось переместить, это не критично для неактивных
                // Продолжаем удаление филиала
                logWarn('BranchDelete', 'Не удалось переместить неактивных сотрудников', eMoveStaff);
            }
        }
        // Если нет других филиалов, неактивные сотрудники останутся с этим branch_id
        // Но при удалении филиала будет ошибка внешнего ключа, которую нужно обработать

        // 6) Обрабатываем неактивные услуги, связанные с этим филиалом
        // Сначала проверяем, есть ли у них активные брони
        const { data: inactiveServices } = await admin
            .from('services')
            .select('id')
            .eq('biz_id', bizId)
            .eq('branch_id', branchId)
            .eq('active', false);

        if (inactiveServices && inactiveServices.length > 0) {
            const serviceIds = inactiveServices.map(s => s.id);
            
            // Проверяем, есть ли у этих услуг активные брони
            const { count: activeBookingsForServices } = await admin
                .from('bookings')
                .select('id', { count: 'exact', head: true })
                .in('service_id', serviceIds)
                .neq('status', 'cancelled');

            if ((activeBookingsForServices ?? 0) > 0) {
                return createErrorResponse('conflict', 'Невозможно удалить филиал: у неактивных услуг есть активные брони. Сначала отмените все активные брони.', undefined, 400);
            }

            // Удаляем отмененные брони для этих неактивных услуг
            // Это позволит удалить услуги, а затем филиал
            const { error: eDelCancelledBookings } = await admin
                .from('bookings')
                .delete()
                .in('service_id', serviceIds)
                .eq('status', 'cancelled');

            if (eDelCancelledBookings) {
                return createErrorResponse('internal', `Не удалось удалить отмененные брони: ${eDelCancelledBookings.message}`, undefined, 400);
            }

            // Теперь пытаемся удалить неактивные услуги
            const { error: eDelServices } = await admin
                .from('services')
                .delete()
                .eq('biz_id', bizId)
                .eq('branch_id', branchId)
                .eq('active', false);

            if (eDelServices) {
                return createErrorResponse('internal', `Не удалось удалить неактивные услуги: ${eDelServices.message}`, undefined, 400);
            }
        }

        // 7) удаляем филиал
        const { error: eDel } = await admin
            .from('branches')
            .delete()
            .eq('id', branchId)
            .eq('biz_id', bizId);

        if (eDel) {
            // Если ошибка из-за неактивных сотрудников (внешний ключ), 
            // пытаемся удалить их или переместить
            const errorMsg = eDel.message.toLowerCase();
            if (errorMsg.includes('foreign key') && errorMsg.includes('staff')) {
                // Проверяем, есть ли еще неактивные сотрудники
                const { data: inactiveStaff } = await admin
                    .from('staff')
                    .select('id')
                    .eq('biz_id', bizId)
                    .eq('branch_id', branchId)
                    .eq('is_active', false);

                if (inactiveStaff && inactiveStaff.length > 0) {
                    // Если есть другой филиал, перемещаем туда
                    if (otherBranch) {
                        const { error: eMoveAgain } = await admin
                            .from('staff')
                            .update({ branch_id: otherBranch.id })
                            .eq('biz_id', bizId)
                            .eq('branch_id', branchId)
                            .eq('is_active', false);

                        if (!eMoveAgain) {
                            // Повторяем попытку удаления филиала
                            const { error: eDel2 } = await admin
                                .from('branches')
                                .delete()
                                .eq('id', branchId)
                                .eq('biz_id', bizId);

                            if (eDel2) {
                                return createErrorResponse('internal', eDel2.message, undefined, 400);
                            }
                            return createSuccessResponse();
                        }
                    }
                    // Если нет другого филиала, возвращаем ошибку
                    return createErrorResponse('conflict', 'Невозможно удалить филиал: к нему привязаны неактивные сотрудники, а других филиалов нет. Создайте другой филиал или удалите неактивных сотрудников.', undefined, 400);
                }
            }
            return createErrorResponse('internal', eDel.message, undefined, 400);
        }

        return createSuccessResponse();
    });
}
