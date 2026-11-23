import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useBooking } from '../../contexts/BookingContext';
import { useConfirm } from '../../contexts/ConfirmContext';
import { useToast } from '../../contexts/ToastContext';
import { useConfirmBooking } from '../../hooks/useConfirmBooking';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { useLanguage } from '../../i18n';
import { getErrorMessage, isNetworkError } from '../../lib/errors';
import { logError } from '../../lib/log';
import { RootStackParamList } from '../../navigation/types';
import { formatBookingDateLabel, formatBookingPrice } from './bookingFormat';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export function useBookingStep6Confirm(navigation: NavigationProp) {
    const { bookingData, reset } = useBooking();
    const { showToast } = useToast();
    const { confirm } = useConfirm();
    const { isOffline } = useNetworkStatus();
    const { locale, t } = useLanguage();

    const selectedService = bookingData.services.find((service) => service.id === bookingData.serviceId);
    const selectedStaff = bookingData.staff.find((staff) => staff.id === bookingData.staffId);
    const dateLabel = bookingData.selectedDate ? formatBookingDateLabel(bookingData.selectedDate, locale) : null;
    const priceLabel = formatBookingPrice(selectedService, t);

    const { createBooking, isPending } = useConfirmBooking({
        onSuccess: (bookingId) => {
            showToast(t('booking.confirm.created'), 'success');
            reset();
            setTimeout(() => {
                navigation.navigate('BookingDetails', { id: bookingId });
            }, 500);
        },
        onError: (error: Error) => {
            const hasNetworkError = isOffline || isNetworkError(error);

            logError('BookingStep6Confirm', 'Create booking failed', {
                message: error.message,
                isNetworkError: hasNetworkError,
            });

            if (hasNetworkError) {
                showToast(t('booking.confirm.offlineError'), 'error');
                return;
            }

            showToast(getErrorMessage(error, t('booking.confirm.failed'), t), 'error');
        },
    });

    const handleCreateBooking = async () => {
        if (!bookingData.selectedSlot) {
            showToast(t('booking.confirm.selectTime'), 'error');
            return;
        }

        if (!bookingData.business) {
            showToast(t('booking.confirm.incomplete'), 'error');
            return;
        }

        const shouldCreate = await confirm({
            title: t('booking.confirm.title'),
            message: t('booking.confirm.message'),
            confirmLabel: t('booking.confirm.create'),
            cancelLabel: t('booking.confirm.cancel'),
        });

        if (!shouldCreate) {
            return;
        }

        createBooking({
            biz_id: bookingData.business.id,
            branch_id: bookingData.branchId,
            service_id: bookingData.serviceId,
            staff_id: bookingData.staffId,
            start_at: bookingData.selectedSlot.start_at,
        });
    };

    return {
        bookingData,
        selectedService,
        selectedStaff,
        dateLabel,
        priceLabel,
        handleCreateBooking,
        isOffline,
        isPending,
    };
}

