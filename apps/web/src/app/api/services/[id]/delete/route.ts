export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

import { getBizContextForManagers } from '@/lib/authBiz';
import { checkResourceBelongsToBiz } from '@/lib/dbHelpers';
import { getRouteParamRequired } from '@/lib/routeParams';
import { getServiceClient } from '@/lib/supabaseService';

export async function POST(_req: Request, context: unknown) {
    try {
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
            const statusCode = serviceCheck.error === 'Resource not found' ? 404 : 403;
            return NextResponse.json({ 
                ok: false, 
                error: serviceCheck.error === 'Resource not found' ? 'Услуга не найдена' : 'SERVICE_NOT_IN_THIS_BUSINESS',
                details: serviceCheck.error === 'Resource not found' ? undefined : { currentBizId: bizId }
            }, { status: statusCode });
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
            return NextResponse.json({ 
                ok: false, 
                error: 'HAS_BOOKINGS',
                message: 'Невозможно удалить услугу: к ней привязаны будущие брони. Сначала отмените или удалите все будущие брони.',
                details: {
                    total: futureBookingsCount ?? 0,
                    active: futureBookingsCount ?? 0,
                    cancelled: 0,
                    bookings: futureBookings?.slice(0, 5) || [],
                }
            }, { status: 400 });
        }

        // Если есть только прошедшие брони, удаляем их перед удалением услуги
        // Это позволит удалить услугу, сохранив историю в других таблицах при необходимости
        const { error: eDelPastBookings } = await admin
            .from('bookings')
            .delete()
            .eq('service_id', serviceId)
            .lt('start_at', now); // Удаляем только прошедшие брони

        if (eDelPastBookings) {
            return NextResponse.json({ 
                ok: false, 
                error: `Не удалось удалить прошедшие брони: ${eDelPastBookings.message}` 
            }, { status: 400 });
        }

        const { error: eDel } = await admin
            .from('services')
            .delete()
            .eq('id', serviceId)
            .eq('biz_id', bizId);

        if (eDel) return NextResponse.json({ ok: false, error: eDel.message }, { status: 400 });

        return NextResponse.json({ ok: true });
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return NextResponse.json({ok: false, error: msg}, {status: 500});
    }
}
