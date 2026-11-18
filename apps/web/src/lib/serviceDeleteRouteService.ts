import { checkResourceBelongsToBiz } from '@/lib/dbHelpers';
import { logError } from '@/lib/log';

type DeleteFailure = {
    ok: false;
    status: 400 | 403 | 404 | 409;
    error: 'validation' | 'forbidden' | 'not_found' | 'conflict';
    message: string;
    details?: Record<string, unknown>;
};

type DeleteSuccess = {
    ok: true;
    /** The service had history and was switched off instead of deleted (DB-14). */
    archived?: boolean;
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

    // Past bookings are history and are never deleted (DB-14): a service that has them, or that a
    // visit package plan sells, is switched off instead; clients can no longer book it.
    const { count: planCount, error: planError } = await admin
        .from('visit_package_plans')
        .select('id', { count: 'exact', head: true })
        .eq('service_id', serviceId);
    if (planError) {
        return { ok: false, status: 400, error: 'validation', message: 'Не удалось проверить пакеты услуги' };
    }
    if ((planCount ?? 0) > 0) return archiveService(admin, bizId, serviceId);

    const { error: deleteServiceError } = await admin
        .from('services')
        .delete()
        .eq('id', serviceId)
        .eq('biz_id', bizId);

    // bookings and booking_services keep the service (foreign key): switch it off instead.
    if (deleteServiceError?.code === '23503') return archiveService(admin, bizId, serviceId);

    if (deleteServiceError) {
        logError('ServiceDelete', 'Service delete failed', { code: deleteServiceError.code, message: deleteServiceError.message });
        return { ok: false, status: 400, error: 'validation', message: 'Не удалось удалить услугу' };
    }

    return { ok: true };
}

async function archiveService(admin: Parameters<typeof runServiceDeleteRoute>[0]['admin'], bizId: string, serviceId: string): Promise<ServiceDeleteRouteResult> {
    const { error } = await admin.from('services').update({ active: false }).eq('id', serviceId).eq('biz_id', bizId);
    if (error) {
        return { ok: false, status: 400, error: 'validation', message: 'Не удалось выключить услугу' };
    }
    return { ok: true, archived: true };
}
