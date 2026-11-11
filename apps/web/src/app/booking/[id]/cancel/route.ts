import {createServerClient} from '@supabase/ssr';
import {cookies} from 'next/headers';
import {NextResponse} from 'next/server';

import { bookingCancellationError } from '@/lib/bookingCancellationError';
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

    try {
        const {data: {user}} = await supabase.auth.getUser();
        if (!user || !booking || booking.client_id !== user.id) {
            return NextResponse.json({ok: false, error: 'FORBIDDEN'}, {status: 403});
        }
        if (booking.status === 'cancelled') {
            return NextResponse.redirect(new URL(`/booking/${id}`, req.url));
        }

        await runServerCancelBooking(
            {
                supabase,
                clientId: user.id,
                // The status transaction enqueues the notification through the DB trigger.
            },
            id,
        );
    } catch (error) {
        const failure = bookingCancellationError(error);
        if (failure) return NextResponse.json(failure, { status: failure.status });
        logError('BookingCancel', 'Failed to cancel booking', error);
        return NextResponse.json({ok: false, error: error instanceof Error ? error.message : String(error)}, {status: 400});
    }

    // вернём редирект обратно на карточку брони
    return NextResponse.redirect(new URL(`/booking/${id}`, req.url));
}
