import { useState } from 'react';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import Button from '../components/ui/Button';
import EmptyState from '../components/ui/EmptyState';
import { useConfirm } from '../contexts/ConfirmContext';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { useToast } from '../contexts/ToastContext';
import { useLanguage } from '../i18n';
import { RootStackParamList } from '../navigation/types';
import { BookingDetailsSections } from './bookingDetails/BookingDetailsSections';
import { RescheduleSheet } from './bookingDetails/RescheduleSheet';
import { useBookingDetailsData } from './bookingDetails/useBookingDetailsData';
import { ReviewSheet } from './cabinet/ReviewSheet';

type BookingDetailsRouteParams = {
    id: string;
};

type BookingDetailsScreenRouteProp = RouteProp<{ params: BookingDetailsRouteParams }, 'params'>;
type BookingDetailsScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function BookingDetailsScreen() {
    const route = useRoute<BookingDetailsScreenRouteProp>();
    const navigation = useNavigation<BookingDetailsScreenNavigationProp>();
    const { showToast } = useToast();
    const { confirm } = useConfirm();
    const { t } = useLanguage();
    const bookingId = route.params?.id;
    const [rescheduleOpen, setRescheduleOpen] = useState(false);
    const [reviewOpen, setReviewOpen] = useState(false);
    const {
        booking,
        isLoading,
        failure,
        isRetrying,
        retry,
        offlineSavedAt,
        isStaffView,
        cancelBooking,
        isCancelling,
        primaryPhone,
        canCancel,
        rescheduleBooking,
        isRescheduling,
        canReschedule,
        rescheduleTarget,
        canReview,
        startedNotice,
        benefitRescheduleNotice,
        timelineSteps,
        canShowMap,
        openMap,
        openDirections,
        openCall,
        openWhatsApp,
    } = useBookingDetailsData({
        bookingId,
        onRescheduled: () => setRescheduleOpen(false),
        onCancelled: () => {
            navigation.reset({
                index: 0,
                routes: [
                    {
                        name: 'Main',
                        params: {
                            screen: 'Cabinet',
                            params: { screen: 'CabinetMain' },
                        },
                    },
                ],
            });
        },
    });

    const handleRepeat = () => {
        const slug = booking?.business?.slug;
        if (!slug) {
            showToast(t('cabinet.details.repeatError'), 'error');
            return;
        }

        navigation.navigate('Booking', { slug });
    };

    const handleCancel = async () => {
        const shouldCancel = await confirm({
            title: t('cabinet.details.cancelTitle'),
            message: t('cabinet.details.cancelMessage'),
            confirmLabel: t('cabinet.details.cancelConfirm'),
            cancelLabel: t('cabinet.details.cancelKeep'),
            variant: 'danger',
        });

        if (!shouldCancel) {
            return;
        }

        cancelBooking();
    };

    if (isLoading) {
        return <LoadingSpinner message={t('cabinet.details.loading')} />;
    }

    if (!booking) {
        // B4: "not found" only when the server says so; a lost connection or a server error
        // offers a retry instead of telling the client the booking is gone.
        if (failure === 'not_found') {
            return (
                <EmptyState
                    icon="search-outline"
                    title={t('cabinet.details.notFound')}
                    message={t('cabinet.details.notFoundMessage')}
                />
            );
        }
        return (
            <EmptyState
                icon="cloud-offline-outline"
                title={t('cabinet.details.loadError.title')}
                message={t('cabinet.details.loadError.message')}
                action={<Button title={t('cabinet.ui.retry')} onPress={retry} variant="outline" loading={isRetrying} fullWidth />}
            />
        );
    }

    return (
        <>
            <BookingDetailsSections
                booking={booking}
                timelineSteps={timelineSteps}
                canCancel={canCancel}
                isCancelling={isCancelling}
                primaryPhone={primaryPhone}
                onRepeat={handleRepeat}
                onCancel={handleCancel}
                canReschedule={canReschedule}
                startedNotice={startedNotice}
                benefitRescheduleNotice={benefitRescheduleNotice}
                onReschedule={() => setRescheduleOpen(true)}
                onCall={openCall}
                onWhatsApp={openWhatsApp}
                isStaffView={isStaffView}
                offlineSavedAt={offlineSavedAt}
                onRetry={retry}
                canReview={canReview}
                onReview={() => setReviewOpen(true)}
                canShowMap={canShowMap}
                onShowMap={openMap}
                onDirections={openDirections}
            />
            {rescheduleOpen && rescheduleTarget ? (
                <RescheduleSheet
                    visible={rescheduleOpen}
                    target={rescheduleTarget}
                    timeZone={booking.business?.tz}
                    isSubmitting={isRescheduling}
                    onClose={() => setRescheduleOpen(false)}
                    onConfirm={rescheduleBooking}
                />
            ) : null}
            {reviewOpen ? (
                <ReviewSheet
                    visible={reviewOpen}
                    bookingId={booking.id}
                    existingReview={booking.review ?? null}
                    onClose={() => setReviewOpen(false)}
                />
            ) : null}
        </>
    );
}
