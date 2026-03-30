import { useMemo } from 'react';
import { Linking } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useToast } from '../../contexts/ToastContext';
import { apiRequest } from '../../lib/api';
import { logError } from '../../lib/log';
import { buildTimelineSteps, type BookingDetails } from './types';

type Options = {
    bookingId?: string;
    onCancelled?: () => void;
};

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
                return await apiRequest<BookingDetails>(`/mobile/bookings/${bookingId}`, {
                    method: 'GET',
                });
            } catch (error: unknown) {
                logError('BookingDetailsScreen', 'Error fetching booking via API', error);
                throw error;
            }
        },
        enabled: !!bookingId,
    });

    const cancelMutation = useMutation({
        mutationFn: async () => {
            return apiRequest(`/bookings/${bookingId}/cancel`, {
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
            showToast(error.message, 'error');
        },
    });

    const primaryPhone = bookingQuery.data?.business?.phones?.[0] || null;
    const canCancel =
        !!bookingQuery.data &&
        bookingQuery.data.status !== 'cancelled' &&
        bookingQuery.data.status !== 'confirmed';
    const timelineSteps = useMemo(
        () => buildTimelineSteps(bookingQuery.data?.status ?? 'created'),
        [bookingQuery.data?.status],
    );

    const openPhoneUrl = async (url: string, errorMessage: string) => {
        try {
            await Linking.openURL(url);
        } catch {
            showToast(errorMessage, 'error');
        }
    };

    return {
        booking: bookingQuery.data,
        isLoading: bookingQuery.isLoading,
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
