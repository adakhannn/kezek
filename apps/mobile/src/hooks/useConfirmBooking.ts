/**
 * Хук создания брони через API quick-hold (мобильный флоу бронирования).
 * Вынес из BookingStep6Confirm для переиспользования и разделения слоёв.
 */

import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '../lib/api';

export type ConfirmBookingParams = {
    biz_id: string;
    branch_id: string;
    service_id: string;
    staff_id: string;
    start_at: string;
};

export type ConfirmBookingResponse = {
    ok: boolean;
    booking_id: string;
};

async function createBooking(params: ConfirmBookingParams): Promise<ConfirmBookingResponse> {
    return apiRequest<ConfirmBookingResponse>('/api/quick-hold', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
    });
}

export type UseConfirmBookingOptions = {
    onSuccess?: (bookingId: string) => void;
    onError?: (error: Error) => void;
};

export function useConfirmBooking(options: UseConfirmBookingOptions = {}) {
    const { onSuccess, onError } = options;

    const mutation = useMutation({
        mutationFn: createBooking,
        onSuccess: (data) => {
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
