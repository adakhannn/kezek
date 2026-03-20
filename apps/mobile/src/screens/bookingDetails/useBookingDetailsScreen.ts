import { Alert, Linking } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { apiRequest } from '../../lib/api';
import { logError } from '../../lib/log';
import { RootStackParamList } from '../../navigation/types';
import { useToast } from '../../contexts/ToastContext';
import { canClientCancelBooking } from '@core-domain/booking';
import type { BookingDetails, BookingDetailsScreenRouteProp } from './types';

type BookingDetailsScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;

export function useBookingDetailsScreen() {
    const route = useRoute<BookingDetailsScreenRouteProp>();
    const navigation = useNavigation<BookingDetailsScreenNavigationProp>();
    const queryClient = useQueryClient();
    const { showToast } = useToast();
    const bookingId = route.params?.id;

    const { data: booking, isLoading } = useQuery({
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
            setTimeout(() => navigation.goBack(), 500);
        },
        onError: (error: Error) => {
            showToast(error.message, 'error');
        },
    });

    const primaryPhone = booking?.business?.phones?.[0] || null;

    const handleCancel = () => {
        Alert.alert('Отменить бронирование?', 'Вы уверены, что хотите отменить эту запись?', [
            { text: 'Нет', style: 'cancel' },
            {
                text: 'Да, отменить',
                style: 'destructive',
                onPress: () => cancelMutation.mutate(),
            },
        ]);
    };

    const handleCall = () => {
        if (!primaryPhone) return;
        const digits = primaryPhone.replace(/[^\d+]/g, '');
        Linking.openURL(`tel:${digits}`).catch(() => {
            showToast('Не удалось открыть звонилку', 'error');
        });
    };

    const handleWhatsApp = () => {
        if (!primaryPhone) return;
        const digits = primaryPhone.replace(/[^\d]/g, '');
        if (!digits) return;
        Linking.openURL(`https://wa.me/${digits}`).catch(() => {
            showToast('Не удалось открыть WhatsApp', 'error');
        });
    };

    const handleRepeat = () => {
        const slug = booking?.business?.slug;
        if (!slug) {
            showToast('Не удалось открыть запись, бизнес не найден', 'error');
            return;
        }

        navigation.navigate('Booking', { slug });
    };

    return {
        booking,
        isLoading,
        canCancel: booking ? canClientCancelBooking(booking.status) : false,
        isCancelling: cancelMutation.isPending,
        hasPrimaryPhone: !!primaryPhone,
        handleRepeat,
        handleCancel,
        handleCall,
        handleWhatsApp,
    };
}
