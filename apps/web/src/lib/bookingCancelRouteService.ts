import type { SupabaseClient } from '@supabase/supabase-js';

import { checkBookingBelongsToBusiness } from '@/lib/authCheck';
import { getBizContextForManagers } from '@/lib/authBiz';
import { logDebug, logError } from '@/lib/log';
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
    requestUrl,
    fetchImpl = fetch,
}: {
    supabase: SupabaseClient;
    bookingId: string;
    requestUrl: string;
    fetchImpl?: typeof fetch;
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
                await notifyBookingChange({
                    bookingId: id,
                    type,
                    requestUrl,
                    fetchImpl,
                });
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

async function notifyBookingChange({
    bookingId,
    type,
    requestUrl,
    fetchImpl,
}: {
    bookingId: string;
    type: 'hold' | 'confirm' | 'cancel';
    requestUrl: string;
    fetchImpl: typeof fetch;
}) {
    logDebug('BookingsCancel', 'Triggering notifications', { bookingId, type });

    try {
        const notifyUrl = new URL('/api/notify', requestUrl);
        const response = await fetchImpl(notifyUrl, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ type, booking_id: bookingId }),
        });

        if (!response.ok) {
            const errorText = await response.text().catch(() => 'Unknown error');
            logError('BookingsCancel', 'Notify API error', {
                status: response.status,
                errorText,
            });
            return;
        }

        const result = await response.json().catch(() => ({}));
        logDebug('BookingsCancel', 'Notify API success', result);
    } catch (error) {
        logError('BookingsCancel', 'Notify API exception', error);
    }
}
