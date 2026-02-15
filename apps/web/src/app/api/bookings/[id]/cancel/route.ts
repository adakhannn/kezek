// apps/web/src/app/api/bookings/[id]/cancel/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { withErrorHandler, createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { getBizContextForManagers } from '@/lib/authBiz';
import { checkBookingBelongsToBusiness } from '@/lib/authCheck';
import { getRouteParamUuid } from '@/lib/routeParams';
import { createSupabaseServerClient } from '@/lib/supabaseHelpers';

export async function POST(_: Request, context: unknown) {
    return withErrorHandler('BookingsCancel', async () => {
        // Валидация UUID для предотвращения потенциальных проблем безопасности
        const bookingId = await getRouteParamUuid(context, 'id');

        // Используем унифицированную утилиту для создания Supabase клиента
        const supabase = await createSupabaseServerClient();

        // проверим, что бронь принадлежит текущему пользователю
        const {data: b} = await supabase
            .from('bookings')
            .select('id, client_id, biz_id, status')
            .eq('id', bookingId)
            .maybeSingle();

        const {data: auth} = await supabase.auth.getUser();
        
        if (!auth.user || !b) {
            return createErrorResponse('forbidden', 'Доступ запрещен', undefined, 403);
        }

        // Если это клиент - проверяем, что бронь принадлежит ему
        // Если это менеджер - проверяем, что бронь принадлежит его бизнесу
        if (b.client_id === auth.user.id) {
            // Клиент отменяет свою бронь - разрешено
        } else {
            // Пытаемся проверить, является ли пользователь менеджером бизнеса
            try {
                const { bizId } = await getBizContextForManagers();
                const check = await checkBookingBelongsToBusiness(bookingId, bizId);
                if (!check.belongs) {
                    return createErrorResponse('forbidden', 'Доступ запрещен', undefined, 403);
                }
            } catch {
                // Если не менеджер - проверяем, что это клиент
                if (b.client_id !== auth.user.id) {
                    return createErrorResponse('forbidden', 'Доступ запрещен', undefined, 403);
                }
            }
        }

        // Если уже отменена, возвращаем успех
        if (b.status === 'cancelled') {
            return createSuccessResponse();
        }

        // Пытаемся отменить через RPC
        const {error} = await supabase.rpc('cancel_booking', {p_booking_id: bookingId});
        
        // Если ошибка связана с назначением сотрудника, обновляем статус напрямую
        if (error) {
            const errorMsg = error.message.toLowerCase();
            if (errorMsg.includes('not assigned to branch') || errorMsg.includes('staff')) {
                // Обновляем статус напрямую, минуя проверку назначения
                const {error: updateError} = await supabase
                    .from('bookings')
                    .update({status: 'cancelled'})
                    .eq('id', bookingId)
                    .eq('client_id', auth.user.id);
                
                if (updateError) {
                    return createErrorResponse('validation', updateError.message, undefined, 400);
                }
            } else {
                return createErrorResponse('validation', error.message, undefined, 400);
            }
        }

        // триггерим уведомления
        await fetch(`${process.env.NEXT_PUBLIC_SITE_ORIGIN || ''}/api/notify`, {
            method: 'POST',
            headers: {'content-type': 'application/json'},
            body: JSON.stringify({type: 'cancel', booking_id: bookingId}),
        }).catch(() => {
        });

        return createSuccessResponse();
    });
}
