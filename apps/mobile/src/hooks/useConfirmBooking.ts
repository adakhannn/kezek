/**
 * Хук создания брони через API quick-hold (мобильный флоу бронирования).
 * Вынес из BookingStep6Confirm для переиспользования и разделения слоёв.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLanguage, type Translate } from '../i18n';
import { apiRequest } from '../lib/api';
import { acknowledgeBookingRequest, getBookingRequestKey } from '../lib/bookingRequest';
import { supabase } from '../lib/supabase';
import type { BookingRequestPayload } from '../screens/booking/bookingSelection';

/** One service as service_id, several as services[] (C3, same body as the website). */
export type ConfirmBookingParams = BookingRequestPayload;

export type ConfirmBookingResponse = {
    booking_id: string;
    confirmed?: boolean;
};

type QuickHoldApiResponse = {
    booking_id?: string;
    confirmed?: boolean;
    data?: {
        booking_id?: string;
        confirmed?: boolean;
    };
};

async function createBooking(params: ConfirmBookingParams, t: Translate): Promise<ConfirmBookingResponse> {
    // The request identity belongs to this account, never to the previous one on the device.
    const {
        data: { session },
    } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    if (!userId) throw new Error(t('cabinet.error.sessionExpired'));
    const requestId = await getBookingRequestKey(userId, params);
    const response = await apiRequest<QuickHoldApiResponse>('/api/quick-hold', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': requestId },
        body: JSON.stringify(params),
    });

    const confirmed = normalizeConfirmBookingResponse(response, t);
    // A storage failure keeps the safe replay identity; it must not report a
    // failed booking after the server's confirmed response has been received.
    try { await acknowledgeBookingRequest(userId, params, requestId); } catch { /* Keep the receipt identity. */ }
    return confirmed;
}

function normalizeConfirmBookingResponse(response: QuickHoldApiResponse, t: Translate): ConfirmBookingResponse {
    const bookingId = response.data?.booking_id ?? response.booking_id;

    if (!bookingId || (response.data?.confirmed ?? response.confirmed) !== true) {
        throw new Error(t('booking.error.noBookingNumber'));
    }

    return {
        booking_id: bookingId,
        confirmed: response.data?.confirmed ?? response.confirmed,
    };
}

export type UseConfirmBookingOptions = {
    onSuccess?: (bookingId: string) => void;
    onError?: (error: Error) => void;
};

export function useConfirmBooking(options: UseConfirmBookingOptions = {}) {
    const { onSuccess, onError } = options;
    const queryClient = useQueryClient();
    const { t } = useLanguage();

    const mutation = useMutation({
        mutationFn: (params: ConfirmBookingParams) => createBooking(params, t),
        onSuccess: (data) => {
            // The cabinet lists (staleTime 5 min) and the slot grid must show the new booking at
            // once, as cancellation already does (MOB-04).
            void queryClient.invalidateQueries({ queryKey: ['bookings'] });
            void queryClient.invalidateQueries({ queryKey: ['slots'] });
            void queryClient.invalidateQueries({ queryKey: ['client-day-bookings'] });
            onSuccess?.(data.booking_id);
        },
        onError: (error: Error) => {
            onError?.(error);
        },
    });

    return {
        createBooking: mutation.mutate,
        createBookingAsync: mutation.mutateAsync,
        isPending: mutation.isPending,
        error: mutation.error,
        isError: mutation.isError,
    };
}
