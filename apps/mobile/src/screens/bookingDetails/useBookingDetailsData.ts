import { useMemo } from 'react';
import { Linking } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useToast } from '../../contexts/ToastContext';
import { useLanguage } from '../../i18n';
import { apiRequest } from '../../lib/api';
import { getErrorMessage } from '../../lib/errors';
import { rescheduleBookingRequest } from '../../lib/bookingReschedule';
import { logError } from '../../lib/log';
import { supabase } from '../../lib/supabase';
import { buildTimelineSteps, type BookingDetails } from './types';
import { canCancel as canCancelBooking, clientBookingActions, type BookingStatus } from '@core-domain/booking';

type ApiEnvelope<T> = {
    ok?: boolean;
    data?: T;
};

type Options = {
    bookingId?: string;
    onCancelled?: () => void;
    onRescheduled?: () => void;
};

function unwrapBookingDetails(payload: BookingDetails | ApiEnvelope<BookingDetails>): BookingDetails {
    if (payload && typeof payload === 'object' && 'data' in payload && payload.data) {
        return payload.data;
    }

    return payload as BookingDetails;
}

export function useBookingDetailsData({ bookingId, onCancelled, onRescheduled }: Options) {
    const queryClient = useQueryClient();
    const { showToast } = useToast();
    const { t } = useLanguage();

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
            showToast(t('cabinet.details.cancelled'), 'success');
            onCancelled?.();
        },
        onError: (error: Error) => {
            showToast(
                getErrorMessage(error, t('cabinet.details.cancelError'), t),
                'error',
            );
        },
    });

    const rescheduleMutation = useMutation({
        mutationFn: async (startAt: string) => {
            if (!bookingId) throw new Error(t('cabinet.details.rescheduleError'));
            // The request identity belongs to this account, as for booking creation.
            const {
                data: { session },
            } = await supabase.auth.getSession();
            const userId = session?.user?.id;
            if (!userId) throw new Error(t('cabinet.error.sessionExpired'));
            return rescheduleBookingRequest(userId, bookingId, startAt);
        },
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: ['booking', bookingId] });
            void queryClient.invalidateQueries({ queryKey: ['bookings'] });
            void queryClient.invalidateQueries({ queryKey: ['slots'] });
            void queryClient.invalidateQueries({ queryKey: ['reschedule-slots'] });
            showToast(t('cabinet.details.rescheduled'), 'success');
            onRescheduled?.();
        },
        onError: (error: Error) => {
            // A time offered a moment ago may be taken now: refresh the grid.
            void queryClient.invalidateQueries({ queryKey: ['reschedule-slots'] });
            showToast(getErrorMessage(error, t('cabinet.details.rescheduleError'), t), 'error');
        },
    });

    const booking = bookingQuery.data?.id === bookingId ? bookingQuery.data : undefined;
    const primaryPhone = booking?.business?.phones?.[0] || null;
    // R25-10: the client's cancel and reschedule end at the start; then only the business changes it.
    const ownActions = booking
        ? clientBookingActions({
              status: booking.status,
              startAt: booking.start_at,
              promotionApplied: booking.benefit_applied ? true : null,
          })
        : null;
    const canCancel = !!booking && canCancelBooking(booking.status as BookingStatus) && !!ownActions?.canCancel;
    const rescheduleTarget = useMemo(
        () =>
            booking?.biz_id && booking.branch_id && booking.staff_id
                ? {
                      bizId: booking.biz_id,
                      branchId: booking.branch_id,
                      staffId: booking.staff_id,
                      startAt: booking.start_at,
                      endAt: booking.end_at,
                  }
                : null,
        [booking?.biz_id, booking?.branch_id, booking?.staff_id, booking?.start_at, booking?.end_at],
    );
    const canReschedule = !!ownActions?.canReschedule && !!rescheduleTarget;
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
        rescheduleBooking: (startAt: string) => rescheduleMutation.mutate(startAt),
        isRescheduling: rescheduleMutation.isPending,
        canReschedule,
        rescheduleTarget,
        startedNotice: !!ownActions?.started,
        benefitRescheduleNotice: !!ownActions?.rescheduleNeedsBusiness,
        primaryPhone,
        canCancel,
        timelineSteps,
        openCall: () => {
            if (!primaryPhone) return;
            const digits = primaryPhone.replace(/[^\d+]/g, '');
            void openPhoneUrl(`tel:${digits}`, t('cabinet.details.callError'));
        },
        openWhatsApp: () => {
            if (!primaryPhone) return;
            const digits = primaryPhone.replace(/[^\d]/g, '');
            if (!digits) return;
            void openPhoneUrl(`https://wa.me/${digits}`, t('cabinet.details.whatsappError'));
        },
    };
}
