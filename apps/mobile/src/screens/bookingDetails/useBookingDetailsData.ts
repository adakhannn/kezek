import { useMemo } from 'react';
import { Linking } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useToast } from '../../contexts/ToastContext';
import { apiRequest } from '../../lib/api';
import { getErrorMessage } from '../../lib/errors';
import { logError } from '../../lib/log';
import { buildTimelineSteps, type BookingDetails } from './types';

type ApiEnvelope<T> = {
    ok?: boolean;
    data?: T;
};

type Options = {
    bookingId?: string;
    onCancelled?: () => void;
};

function unwrapBookingDetails(payload: BookingDetails | ApiEnvelope<BookingDetails>): BookingDetails {
    if (payload && typeof payload === 'object' && 'data' in payload && payload.data) {
        return payload.data;
    }

    return payload as BookingDetails;
}

export function useBookingDetailsData({ bookingId, onCancelled }: Options) {
    const queryClient = useQueryClient();
    const { showToast } = useToast();

    const bookingQuery = useQuery({
        queryKey: ['booking', bookingId],
        queryFn: async () => {
            if (!bookingId) {
                throw new Error('Не указан идентификатор бронирования');
            }

            try {
                const payload = await apiRequest<BookingDetails | ApiEnvelope<BookingDetails>>(`/mobile/bookings/${bookingId}`, {
                    method: 'GET',
                });
                return unwrapBookingDetails(payload);
            } catch (error: unknown) {
                logError('BookingDetailsScreen', 'Error fetching booking via API', error);
                throw error;
            }
        },
        enabled: !!bookingId,
    });

    const cancelMutation = useMutation({
        mutationFn: async () => {
            return apiRequest(`/mobile/bookings/${bookingId}`, {
                method: 'POST',
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['booking', bookingId] });
            queryClient.invalidateQueries({ queryKey: ['bookings'] });
            showToast('Бронирование отменено', 'success');
            onCancelled?.();
        },
        onError: (error: Error) => {
            showToast(
                getErrorMessage(error, 'Не удалось отменить запись. Попробуйте снова.'),
                'error',
            );
        },
    });

    const booking = bookingQuery.data?.id === bookingId ? bookingQuery.data : undefined;
    const primaryPhone = booking?.business?.phones?.[0] || null;
    const canCancel =
        !!booking &&
        booking.status !== 'cancelled' &&
        booking.status !== 'paid' &&
        booking.status !== 'no_show';
    const timelineSteps = useMemo(
        () => buildTimelineSteps(booking?.status ?? 'created'),
        [booking?.status],
    );

    const openPhoneUrl = async (url: string, errorMessage: string) => {
        try {
            await Linking.openURL(url);
        } catch {
            showToast(errorMessage, 'error');
        }
    };

    return {
        booking,
        isLoading: bookingQuery.isLoading || (!booking && bookingQuery.isFetching),
        cancelBooking: () => cancelMutation.mutate(),
        isCancelling: cancelMutation.isPending,
        primaryPhone,
        canCancel,
        timelineSteps,
        openCall: () => {
            if (!primaryPhone) return;
            const digits = primaryPhone.replace(/[^\d+]/g, '');
            void openPhoneUrl(`tel:${digits}`, 'Не удалось открыть звонилку');
        },
        openWhatsApp: () => {
            if (!primaryPhone) return;
            const digits = primaryPhone.replace(/[^\d]/g, '');
            if (!digits) return;
            void openPhoneUrl(`https://wa.me/${digits}`, 'Не удалось открыть WhatsApp');
        },
    };
}
