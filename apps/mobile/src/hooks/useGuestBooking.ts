/**
 * A booking without an account (C1): POST /api/quick-book-guest, exactly as the website sends it
 * (useGuestBooking + quickBookGuestClient): the same payload plus the contacts, an Idempotency-Key
 * and the guest secret (X-Booking-Client-Token) persisted before the request, so a retry after a
 * lost answer replays the same attempt.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useLanguage, type Translate } from '../i18n';
import { apiRequest } from '../lib/api';
import { acknowledgeGuestBookingRequest, getGuestBookingRequestIdentity } from '../lib/bookingRequest';
import type { BookingRequestPayload } from '../screens/booking/bookingSelection';

export type GuestBookingParams = BookingRequestPayload & {
    client_name: string;
    client_phone: string;
    client_email: string | null;
};

type GuestBookingApiResponse = {
    booking_id?: string;
    confirmed?: boolean;
    data?: { booking_id?: string; confirmed?: boolean };
};

async function createGuestBooking(params: GuestBookingParams, t: Translate): Promise<string> {
    const identity = await getGuestBookingRequestIdentity(params);
    const response = await apiRequest<GuestBookingApiResponse>('/api/quick-book-guest', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Idempotency-Key': identity.requestId,
            'X-Booking-Client-Token': identity.guestSecret,
        },
        body: JSON.stringify(params),
    });
    const bookingId = response?.data?.booking_id ?? response?.booking_id;
    if (!bookingId || (response?.data?.confirmed ?? response?.confirmed) !== true) {
        throw new Error(t('booking.error.noBookingNumber'));
    }
    // A storage failure keeps a replayable identity; it never turns a booking into an error.
    try { await acknowledgeGuestBookingRequest(params, identity.requestId); } catch { /* Keep the receipt identity. */ }
    return bookingId;
}

export function useGuestBooking(options: { onSuccess?: (bookingId: string) => void; onError?: (error: Error) => void } = {}) {
    const queryClient = useQueryClient();
    const { t } = useLanguage();
    const mutation = useMutation({
        mutationFn: (params: GuestBookingParams) => createGuestBooking(params, t),
        onSuccess: (bookingId) => {
            void queryClient.invalidateQueries({ queryKey: ['slots'] });
            options.onSuccess?.(bookingId);
        },
        onError: (error: Error) => options.onError?.(error),
    });
    return {
        createGuestBooking: mutation.mutate,
        createGuestBookingAsync: mutation.mutateAsync,
        isPending: mutation.isPending,
    };
}
