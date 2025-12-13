// apps/web/src/app/api/bookings/[id]/cancel/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import {createServerClient} from '@supabase/ssr';
import {cookies} from 'next/headers';
import {NextResponse} from 'next/server';

import { formatErrorSimple } from '@/lib/errors';
import { getRouteParamRequired } from '@/lib/routeParams';

export async function POST(_: Request, context: unknown) {
    try {
        const bookingId = await getRouteParamRequired(context, 'id');

        const cookieStore = await cookies();
        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    get: n => cookieStore.get(n)?.value, set: () => {
                    }, remove: () => {
                    }
                }
            }
        );

        // проверим, что бронь принадлежит текущему пользователю
        const {data: b} = await supabase
            .from('bookings')
            .select('id, client_id, status')
            .eq('id', bookingId)
            .maybeSingle();

        const {data: auth} = await supabase.auth.getUser();
        if (!auth.user || !b || b.client_id !== auth.user.id) {
            return NextResponse.json({ok: false, error: 'FORBIDDEN'}, {status: 403});
        }

        // Если уже отменена, возвращаем успех
        if (b.status === 'cancelled') {
            return NextResponse.json({ok: true});
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
                    return NextResponse.json({ok: false, error: updateError.message}, {status: 400});
                }
            } else {
                return NextResponse.json({ok: false, error: error.message}, {status: 400});
            }
        }

        // триггерим уведомления
        await fetch(`${process.env.NEXT_PUBLIC_SITE_ORIGIN || ''}/api/notify`, {
            method: 'POST',
            headers: {'content-type': 'application/json'},
            body: JSON.stringify({type: 'cancel', booking_id: bookingId}),
        }).catch(() => {
        });

        return NextResponse.json({ok: true});
    } catch (e) {
        return NextResponse.json({ok: false, error: formatErrorSimple(e)}, {status: 500});
    }
}
