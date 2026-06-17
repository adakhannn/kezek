import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { formatDateLabel, formatServicePrice } from '@shared-client/formatters';
import { useBooking } from '../../contexts/BookingContext';
import { useConfirm } from '../../contexts/ConfirmContext';
import { useToast } from '../../contexts/ToastContext';
import { useConfirmBooking } from '../../hooks/useConfirmBooking';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { getErrorMessage, isNetworkError } from '../../lib/errors';
import { logError } from '../../lib/log';
import { RootStackParamList } from '../../navigation/types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export function useBookingStep6Confirm(navigation: NavigationProp) {
    const { bookingData, reset } = useBooking();
    const { showToast } = useToast();
    const { confirm } = useConfirm();
    const { isOffline } = useNetworkStatus();

    const selectedService = bookingData.services.find((service) => service.id === bookingData.serviceId);
    const selectedStaff = bookingData.staff.find((staff) => staff.id === bookingData.staffId);
    const dateLabel = bookingData.selectedDate ? formatDateLabel(bookingData.selectedDate, 'ru-RU') : null;
    const priceLabel = formatServicePrice(selectedService, 'сом');

    const { createBooking, isPending } = useConfirmBooking({
        onSuccess: (bookingId) => {
            showToast('Запись создана!', 'success');
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
                showToast(
                    'Нет подключения к интернету. Запись не создана. Проверьте соединение и попробуйте снова.',
                    'error',
                );
                return;
            }

            showToast(
                getErrorMessage(error, 'Не удалось создать запись. Попробуйте снова.'),
                'error',
            );
        },
    });

    const handleCreateBooking = async () => {
        if (!bookingData.selectedSlot) {
            showToast('Выберите время', 'error');
            return;
        }

        if (!bookingData.business) {
            showToast('Данные бронирования неполные', 'error');
            return;
        }

        const shouldCreate = await confirm({
            title: 'Подтверждение',
            message: 'Создать запись?',
            confirmLabel: 'Создать',
            cancelLabel: 'Отмена',
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

