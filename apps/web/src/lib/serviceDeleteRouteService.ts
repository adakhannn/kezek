import { checkResourceBelongsToBiz } from '@/lib/dbHelpers';

type DeleteFailure = {
    ok: false;
    status: 400 | 403 | 404 | 409;
    error: 'validation' | 'forbidden' | 'not_found' | 'conflict';
    message: string;
    details?: Record<string, unknown>;
};

type DeleteSuccess = {
    ok: true;
};

export type ServiceDeleteRouteResult = DeleteFailure | DeleteSuccess;

export async function runServiceDeleteRoute({
    admin,
    bizId,
    serviceId,
    now = new Date().toISOString(),
}: {
    admin: any;
    bizId: string;
    serviceId: string;
    now?: string;
}): Promise<ServiceDeleteRouteResult> {
    const serviceCheck = await checkResourceBelongsToBiz<{ id: string; biz_id: string }>(
        admin,
        'services',
        serviceId,
        bizId,
        'id, biz_id',
    );

    if (serviceCheck.error || !serviceCheck.data) {
        if (serviceCheck.error === 'Resource not found') {
            return {
                ok: false,
                status: 404,
                error: 'not_found',
                message: 'Услуга не найдена',
            };
        }

        return {
            ok: false,
            status: 403,
            error: 'forbidden',
            message: 'Услуга не принадлежит этому бизнесу',
            details: { currentBizId: bizId },
        };
    }

    const { data: futureBookings, count: futureBookingsCount } = await admin
        .from('bookings')
        .select('id,status,start_at,client_name', { count: 'exact' })
        .eq('service_id', serviceId)
        .gte('start_at', now)
        .neq('status', 'cancelled')
        .limit(10);

    if ((futureBookingsCount ?? 0) > 0) {
        return {
            ok: false,
            status: 409,
            error: 'conflict',
            message:
                'Невозможно удалить услугу: к ней привязаны будущие брони. Сначала отмените или удалите все будущие брони.',
            details: {
                total: futureBookingsCount ?? 0,
                active: futureBookingsCount ?? 0,
                cancelled: 0,
                bookings: futureBookings?.slice(0, 5) || [],
            },
        };
    }

    const { error: deletePastBookingsError } = await admin
        .from('bookings')
        .delete()
        .eq('service_id', serviceId)
        .lt('start_at', now);

    if (deletePastBookingsError) {
        return {
            ok: false,
            status: 400,
            error: 'validation',
            message: `Не удалось удалить прошедшие брони: ${deletePastBookingsError.message}`,
        };
    }

    const { error: deleteServiceError } = await admin
        .from('services')
        .delete()
        .eq('id', serviceId)
        .eq('biz_id', bizId);

    if (deleteServiceError) {
        return {
            ok: false,
            status: 400,
            error: 'validation',
            message: deleteServiceError.message,
        };
    }

    return { ok: true };
}
