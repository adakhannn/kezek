export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { withErrorHandler, createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { getBizContextForManagers } from '@/lib/authBiz';
import { checkResourceBelongsToBiz } from '@/lib/dbHelpers';
import { getRouteParamRequired } from '@/lib/routeParams';
import { getServiceClient } from '@/lib/supabaseService';

export async function POST(_req: Request, context: unknown) {
    return withErrorHandler('ServicesDelete', async () => {
        const serviceId = await getRouteParamRequired(context, 'id');
        const { bizId } = await getBizContextForManagers();
        const admin = getServiceClient();

        // услуга принадлежит бизнесу? (используем унифицированную утилиту)
        const serviceCheck = await checkResourceBelongsToBiz<{ id: string; biz_id: string }>(
            admin,
            'services',
            serviceId,
            bizId,
            'id, biz_id'
        );
        if (serviceCheck.error || !serviceCheck.data) {
            if (serviceCheck.error === 'Resource not found') {
                return createErrorResponse('not_found', 'Услуга не найдена', undefined, 404);
            }
            return createErrorResponse('forbidden', 'Услуга не принадлежит этому бизнесу', { currentBizId: bizId }, 403);
        }

        // Проверяем только будущие брони (прошедшие не должны блокировать удаление)
        const now = new Date().toISOString();
        const { data: futureBookings, count: futureBookingsCount } = await admin
            .from('bookings')
            .select('id,status,start_at,client_name', { count: 'exact' })
            .eq('service_id', serviceId)
            .gte('start_at', now) // Только будущие брони
            .neq('status', 'cancelled') // Исключаем отмененные
            .limit(10);

        if ((futureBookingsCount ?? 0) > 0) {
            return createErrorResponse(
                'conflict',
                'Невозможно удалить услугу: к ней привязаны будущие брони. Сначала отмените или удалите все будущие брони.',
                {
                    total: futureBookingsCount ?? 0,
                    active: futureBookingsCount ?? 0,
                    cancelled: 0,
                    bookings: futureBookings?.slice(0, 5) || [],
                },
                409
            );
        }

        // Если есть только прошедшие брони, удаляем их перед удалением услуги
        // Это позволит удалить услугу, сохранив историю в других таблицах при необходимости
        const { error: eDelPastBookings } = await admin
            .from('bookings')
            .delete()
            .eq('service_id', serviceId)
            .lt('start_at', now); // Удаляем только прошедшие брони

        if (eDelPastBookings) {
            return createErrorResponse('validation', `Не удалось удалить прошедшие брони: ${eDelPastBookings.message}`, undefined, 400);
        }

        const { error: eDel } = await admin
            .from('services')
            .delete()
            .eq('id', serviceId)
            .eq('biz_id', bizId);

        if (eDel) {
            return createErrorResponse('validation', eDel.message, undefined, 400);
        }

        return createSuccessResponse();
    });
}
