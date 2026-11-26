import type { SupabaseClient } from '@supabase/supabase-js';

import { getBizContextForManagers } from '@/lib/authBiz';
import { checkBookingBelongsToBusiness } from '@/lib/authCheck';
import { bookingCancellationError } from '@/lib/bookingCancellationError';
import { dispatchBookingNotification } from '@/lib/bookingNotificationDispatch';
import { runServerCancelBooking } from '@/lib/serverCancelBookingService';

type BookingRow = {
    id: string;
    client_id: string | null;
    biz_id: string | null;
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

export type BookingCancelRouteResult = CancelFailure | CancelSuccess | NonNullable<ReturnType<typeof bookingCancellationError>>;

export async function runBookingCancelRoute({
    supabase,
    bookingId,
    isBusinessManager,
}: {
    supabase: SupabaseClient;
    bookingId: string;
    /**
     * The management check of a caller without the website's business context (the app's Bearer
     * token): true when the user manages the booking's business. Absent: the cookie context decides.
     */
    isBusinessManager?: (userId: string, bizId: string) => Promise<boolean>;
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
        const hasManagerAccess = isBusinessManager
            ? Boolean(booking.biz_id) && await isBusinessManager(user.id, String(booking.biz_id))
            : await canManagerCancelBooking(bookingId);
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

    try {
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
    } catch (error) {
        const failure = bookingCancellationError(error);
        if (failure) return failure;
        throw error;
    }

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
