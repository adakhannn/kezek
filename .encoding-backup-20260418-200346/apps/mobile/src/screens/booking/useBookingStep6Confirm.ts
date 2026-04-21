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
    const priceLabel = formatServicePrice(selectedService, 'СЃРѕРј');

    const { createBooking, isPending } = useConfirmBooking({
        onSuccess: (bookingId) => {
            showToast('?????? ???????!', 'success');
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
                    'РќРµС‚ СЃРµС‚Рё РёР»Рё РѕС€РёР±РєР° СЃРµСЂРІРµСЂР°. Р—Р°РїРёСЃСЊ РЅРµ СЃРѕР·РґР°РЅР°, РїРѕРїСЂРѕР±СѓР№С‚Рµ РµС‰С‘ СЂР°Р·, РєРѕРіРґР° СЃРѕРµРґРёРЅРµРЅРёРµ РІРѕСЃСЃС‚Р°РЅРѕРІРёС‚СЃСЏ.',
                    'error',
                );
                return;
            }

            showToast(error.message || 'РќРµ СѓРґР°Р»РѕСЃСЊ СЃРѕР·РґР°С‚СЊ Р·Р°РїРёСЃСЊ', 'error');
        },
    });

    const handleCreateBooking = async () => {
        if (!bookingData.selectedSlot) {
            showToast('Р’С‹Р±РµСЂРёС‚Рµ РІСЂРµРјСЏ', 'error');
            return;
        }

        if (!bookingData.business) {
            showToast('Р”Р°РЅРЅС‹Рµ Р±СЂРѕРЅРёСЂРѕРІР°РЅРёСЏ РЅРµРїРѕР»РЅС‹Рµ', 'error');
            return;
        }

        const shouldCreate = await confirm({
            title: 'РџРѕРґС‚РІРµСЂР¶РґРµРЅРёРµ',
            message: 'РЎРѕР·РґР°С‚СЊ Р·Р°РїРёСЃСЊ?',
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
