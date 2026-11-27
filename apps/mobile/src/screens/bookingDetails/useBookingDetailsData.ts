import { useMemo } from 'react';
import { Linking } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useToast } from '../../contexts/ToastContext';
import { useLanguage } from '../../i18n';
import { apiRequest } from '../../lib/api';
import { branchDirectionsUrl, branchMapUrl, canShowOnMap } from '../../lib/branchMap';
import { getErrorMessage } from '../../lib/errors';
import { rescheduleBookingRequest } from '../../lib/bookingReschedule';
import { logError } from '../../lib/log';
import { supabase } from '../../lib/supabase';
import { BookingDetailsLoadError, loadBookingDetails, type BookingDetailsFailure } from './bookingDetailsLoad';
import { buildTimelineSteps } from './types';
import { canCancel as canCancelBooking, clientBookingActions, type BookingStatus } from '@core-domain/booking';

type Options = {
    bookingId?: string;
    onCancelled?: () => void;
    onRescheduled?: () => void;
};

async function currentUserId(): Promise<string | null> {
    try {
        const {
            data: { session },
        } = await supabase.auth.getSession();
        return session?.user?.id ?? null;
    } catch {
        return null;
    }
}

export function useBookingDetailsData({ bookingId, onCancelled, onRescheduled }: Options) {
    const queryClient = useQueryClient();
    const { showToast } = useToast();
    const { t } = useLanguage();

    const bookingQuery = useQuery({
        queryKey: ['booking', bookingId],
        queryFn: async () => {
            if (!bookingId) {
                throw new BookingDetailsLoadError('not_found', new Error(t('cabinet.details.missingId')));
            }

            try {
                return await loadBookingDetails({ bookingId, userId: await currentUserId() });
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
            // The cabinet is shown right after this; mark the visit cancelled in its cached pages so it
            // does not linger as the next visit until the refetch over a slow network lands.
            queryClient.setQueriesData<{ pages?: { items: { id: string; status?: string }[] }[] }>(
                { queryKey: ['bookings'] },
                (old) => old?.pages
                    ? { ...old, pages: old.pages.map((page) => ({
                        ...page,
                        items: page.items.map((item) => (item.id === bookingId ? { ...item, status: 'cancelled' } : item)),
                    })) }
                    : old,
            );
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
            const userId = await currentUserId();
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

    const result = bookingQuery.data;
    const booking = result?.booking.id === bookingId ? result?.booking : undefined;
    const offlineSavedAt = booking ? result?.offlineSavedAt ?? null : null;
    const isOffline = !!offlineSavedAt;
    // B1: a master or manager opened the booking from a push; the client's actions are not theirs.
    const isStaffView = !!booking?.viewer_role && booking.viewer_role !== 'client';
    const clientActionsAllowed = !!booking && !isStaffView && !isOffline;
    const primaryPhone = booking?.business?.phones?.[0] || null;
    // R25-10: the client's cancel and reschedule end at the start; then only the business changes it.
    const ownActions = clientActionsAllowed && booking
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
    const canReview = clientActionsAllowed && (!!booking?.can_review || (!!booking?.review && booking.status === 'paid'));
    const timelineSteps = useMemo(
        () => buildTimelineSteps(booking?.status ?? 'created', !!booking?.promotion),
        [booking?.status, booking?.promotion],
    );
    const loadError = bookingQuery.error;
    const failure: BookingDetailsFailure | null = booking
        ? null
        : loadError instanceof BookingDetailsLoadError
          ? loadError.kind
          : loadError
            ? 'error'
            : null;

    const openUrl = async (url: string | null, errorMessage: string) => {
        if (!url) return;
        try {
            await Linking.openURL(url);
        } catch {
            showToast(errorMessage, 'error');
        }
    };

    const branchPlace = booking?.branch
        ? { lat: booking.branch.lat, lon: booking.branch.lon, address: booking.branch.address, name: booking.branch.name }
        : null;

    return {
        booking,
        isLoading: bookingQuery.isLoading || (!booking && !failure && bookingQuery.isFetching),
        failure,
        isRetrying: bookingQuery.isFetching,
        retry: () => void bookingQuery.refetch(),
        offlineSavedAt,
        isStaffView,
        cancelBooking: () => cancelMutation.mutate(),
        isCancelling: cancelMutation.isPending,
        rescheduleBooking: (startAt: string) => rescheduleMutation.mutate(startAt),
        isRescheduling: rescheduleMutation.isPending,
        canReschedule,
        rescheduleTarget,
        canReview,
        startedNotice: !!ownActions?.started,
        benefitRescheduleNotice: !!ownActions?.rescheduleNeedsBusiness,
        primaryPhone,
        canCancel,
        timelineSteps,
        canShowMap: canShowOnMap(branchPlace),
        openMap: () => {
            if (branchPlace) void openUrl(branchMapUrl(branchPlace), t('cabinet.details.mapError'));
        },
        openDirections: () => {
            if (branchPlace) void openUrl(branchDirectionsUrl(branchPlace), t('cabinet.details.mapError'));
        },
        openCall: () => {
            if (!primaryPhone) return;
            const digits = primaryPhone.replace(/[^\d+]/g, '');
            void openUrl(`tel:${digits}`, t('cabinet.details.callError'));
        },
        openWhatsApp: () => {
            if (!primaryPhone) return;
            const digits = primaryPhone.replace(/[^\d]/g, '');
            if (!digits) return;
            void openUrl(`https://wa.me/${digits}`, t('cabinet.details.whatsappError'));
        },
    };
}
