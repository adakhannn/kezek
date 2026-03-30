import {createServerClient} from '@supabase/ssr';
import {cookies} from 'next/headers';
import {NextResponse} from 'next/server';

import {logError} from '@/lib/log';
import { runServerCancelBooking } from '@/lib/serverCancelBookingService';

export async function POST(
    req: Request,
    {params}: { params: Promise<{ id: string }> }
) {
    const {id} = await params; // ← обязательно await

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const cookieStore = await cookies();

    const supabase = createServerClient(url, anon, {
        cookies: {
            get: (n: string) => cookieStore.get(n)?.value,
            // no-op для RSC/route handlers
            set: () => {
            },
            remove: () => {
            },
        },
    });

    // Проверяем текущий статус брони
    const {data: booking} = await supabase
        .from('bookings')
        .select('id, status, client_id')
        .eq('id', id)
        .maybeSingle();

    // Если уже отменена, редиректим
    if (booking?.status === 'cancelled') {
        return NextResponse.redirect(new URL(`/booking/${id}`, req.url));
    }

    try {
        const {data: {user}} = await supabase.auth.getUser();
        if (!user || !booking || booking.client_id !== user.id) {
            return NextResponse.json({ok: false, error: 'FORBIDDEN'}, {status: 403});
        }

        await runServerCancelBooking(
            {
                supabase,
                clientId: user.id,
                notify: async ({ bookingId, type }) => {
                    await fetch(new URL('/api/notify', req.url), {
                        method: 'POST',
                        headers: { 'content-type': 'application/json' },
                        body: JSON.stringify({ type, booking_id: bookingId }),
                    });
                },
            },
            id,
        );
    } catch (error) {
        logError('BookingCancel', 'Failed to cancel booking', error);
        return NextResponse.json({ok: false, error: error instanceof Error ? error.message : String(error)}, {status: 400});
    }

    // вернём редирект обратно на карточку брони
    return NextResponse.redirect(new URL(`/booking/${id}`, req.url));
}
