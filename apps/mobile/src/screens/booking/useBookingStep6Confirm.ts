import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { formatDateLabel, formatServicePrice } from '@shared-client/formatters';
import { useBooking } from '../../contexts/BookingContext';
import { useConfirm } from '../../contexts/ConfirmContext';
import { useToast } from '../../contexts/ToastContext';
import { useConfirmBooking } from '../../hooks/useConfirmBooking';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
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

    const handleCreateBooking = async () => {
        if (!bookingData.selectedSlot) {
            showToast('Р’С‹Р±РµСЂРёС‚Рµ РІСЂРµРјСЏ', 'error');
            return;
        }

        if (!bookingData.business) {
            showToast('Данные бронирования неполные', 'error');
            return;
        }

        const shouldCreate = await confirm({
            title: 'Подтверждение',
            message: 'Создать запись?',
            confirmLabel: 'РЎРѕР·РґР°С‚СЊ',
            cancelLabel: 'РћС‚РјРµРЅР°',
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
