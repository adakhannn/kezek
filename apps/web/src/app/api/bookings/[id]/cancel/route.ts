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
            .select('id, client_id')
            .eq('id', bookingId)
            .maybeSingle();

        const {data: auth} = await supabase.auth.getUser();
        if (!auth.user || !b || b.client_id !== auth.user.id) {
            return NextResponse.json({ok: false, error: 'FORBIDDEN'}, {status: 403});
        }

        const {error} = await supabase.rpc('cancel_booking', {p_booking_id: bookingId});
        if (error) return NextResponse.json({ok: false, error: error.message}, {status: 400});

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
