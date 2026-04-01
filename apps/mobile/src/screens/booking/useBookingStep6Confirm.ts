import { Alert } from 'react-native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { formatDateLabel, formatServicePrice } from '@shared-client/formatters';
import { useToast } from '../../contexts/ToastContext';
import { useConfirmBooking } from '../../hooks/useConfirmBooking';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { logError } from '../../lib/log';
import { RootStackParamList } from '../../navigation/types';
import { useBooking } from '../../contexts/BookingContext';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export function useBookingStep6Confirm(navigation: NavigationProp) {
    const { bookingData, reset } = useBooking();
    const { showToast } = useToast();
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
            const isNetworkError = isOffline || /network request failed|failed to fetch|network/i.test(error.message);

            logError('BookingStep6Confirm', 'Create booking failed', {
                message: error.message,
                isNetworkError,
            });

            if (isNetworkError) {
                showToast(
                    'Нет сети или ошибка сервера. Запись не создана, попробуйте ещё раз, когда соединение восстановится.',
                    'error',
                );
                return;
            }

            showToast(error.message || 'Не удалось создать запись', 'error');
        },
    });

    const handleCreateBooking = () => {
        if (!bookingData.selectedSlot) {
            showToast('Выберите время', 'error');
            return;
        }

        if (!bookingData.business) {
            showToast('Данные бронирования неполные', 'error');
            return;
        }

        Alert.alert('Подтверждение', 'Создать запись?', [
            { text: 'Отмена', style: 'cancel' },
            {
                text: 'Создать',
                onPress: () =>
                    createBooking({
                        biz_id: bookingData.business!.id,
                        branch_id: bookingData.branchId,
                        service_id: bookingData.serviceId,
                        staff_id: bookingData.staffId,
                        start_at: bookingData.selectedSlot!.start_at,
                    }),
            },
        ]);
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
