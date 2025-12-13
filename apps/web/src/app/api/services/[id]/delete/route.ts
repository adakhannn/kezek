export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

import { getBizContextForManagers } from '@/lib/authBiz';
import { getRouteParamRequired } from '@/lib/routeParams';
import { getServiceClient } from '@/lib/supabaseService';

export async function POST(_req: Request, context: unknown) {
    try {
        const serviceId = await getRouteParamRequired(context, 'id');
        const { bizId } = await getBizContextForManagers();
        const admin = getServiceClient();

        // услуга принадлежит бизнесу?
        const { data: svc, error: svcError } = await admin
            .from('services')
            .select('id,biz_id')
            .eq('id', serviceId)
            .maybeSingle();

        if (svcError) {
            return NextResponse.json({ ok: false, error: `Ошибка проверки услуги: ${svcError.message}` }, { status: 400 });
        }

        if (!svc) {
            return NextResponse.json({ ok: false, error: 'Услуга не найдена' }, { status: 404 });
        }
        if (String(svc.biz_id) !== String(bizId)) {
            return NextResponse.json({ 
                ok: false, 
                error: 'SERVICE_NOT_IN_THIS_BUSINESS',
                details: { serviceBizId: svc.biz_id, currentBizId: bizId }
            }, { status: 403 });
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
