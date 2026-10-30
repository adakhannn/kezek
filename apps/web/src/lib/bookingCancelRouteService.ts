import type { SupabaseClient } from '@supabase/supabase-js';

import { checkBookingBelongsToBusiness } from '@/lib/authCheck';
import { getBizContextForManagers } from '@/lib/authBiz';
import { dispatchBookingNotification } from '@/lib/bookingNotificationDispatch';
import { runServerCancelBooking } from '@/lib/serverCancelBookingService';

type BookingRow = {
    id: string;
    client_id: string | null;
    status: string | null;
};

type CancelFailure = {
    ok: false;
    status: 403 | 404;
    error: 'forbidden' | 'not_found';
    message: string;
};

type CancelSuccess = {
    ok: true;
    alreadyCancelled?: boolean;
};

export type BookingCancelRouteResult = CancelFailure | CancelSuccess;

export async function runBookingCancelRoute({
    supabase,
    bookingId,
}: {
    supabase: SupabaseClient;
    bookingId: string;
}): Promise<BookingCancelRouteResult> {
    const { data: booking } = await supabase
        .from('bookings')
        .select('id, client_id, biz_id, status')
        .eq('id', bookingId)
        .maybeSingle<BookingRow>();

    const { data: auth } = await supabase.auth.getUser();
    const user = auth.user;

    if (!user) {
        return forbidden();
    }

    if (!booking) {
        return {
            ok: false,
            status: 404,
            error: 'not_found',
            message: 'Бронирование не найдено',
        };
    }

    const isClientOwner = booking.client_id === user.id;
    if (!isClientOwner) {
        const hasManagerAccess = await canManagerCancelBooking(bookingId);
        if (!hasManagerAccess) {
            return forbidden();
        }
    }

    if (booking.status === 'cancelled') {
        return {
            ok: true,
            alreadyCancelled: true,
        };
    }

    await runServerCancelBooking(
        {
            supabase,
            clientId: isClientOwner ? user.id : undefined,
            notify: async ({ bookingId: id, type }) => {
                await dispatchBookingNotification(supabase, id, type);
            },
        },
        bookingId,
    );

    return { ok: true };
}

function forbidden(): CancelFailure {
    return {
        ok: false,
        status: 403,
        error: 'forbidden',
        message: 'Доступ запрещен',
    };
}

async function canManagerCancelBooking(bookingId: string): Promise<boolean> {
    try {
        const { bizId } = await getBizContextForManagers();
        const check = await checkBookingBelongsToBusiness(bookingId, bizId);
        return check.belongs;
    } catch {
        return false;
    }
}
