import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { supabase } from '../lib/supabase';
import { apiRequest } from '../lib/api';
import { useToast } from '../contexts/ToastContext';
import { formatDate, formatTime, formatPhone } from '../utils/format';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';

type BookingDetailsRouteParams = {
    id: string;
};

type BookingDetailsScreenRouteProp = RouteProp<{ params: BookingDetailsRouteParams }, 'params'>;
type BookingDetailsScreenNavigationProp = NativeStackNavigationProp<any>;

type BookingDetails = {
    id: string;
    start_at: string;
    end_at: string;
    status: string;
    service: {
        name_ru: string;
        duration_minutes: number;
        price: number | null;
    } | null;
    staff: {
        full_name: string;
    } | null;
    branch: {
        name: string;
        address: string;
    } | null;
    business: {
        name: string;
        phones: string[];
    } | null;
};

export default function BookingDetailsScreen() {
    const route = useRoute<BookingDetailsScreenRouteProp>();
    const navigation = useNavigation<BookingDetailsScreenNavigationProp>();
    const queryClient = useQueryClient();
    const { showToast } = useToast();
    const bookingId = route.params?.id;

    const { data: booking, isLoading } = useQuery({
        queryKey: ['booking', bookingId],
        queryFn: async () => {
            // Получаем текущего пользователя для проверки прав доступа
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                throw new Error('Необходима авторизация');
            }

            const { data, error } = await supabase
                .from('bookings')
                .select(`
                    id,
                    start_at,
                    end_at,
                    status,
                    service:services(name_ru, duration_minutes, price),
                    staff:staff(full_name),
                    branch:branches(name, address),
                    business:businesses(name, phones)
                `)
                .eq('id', bookingId)
                .eq('client_id', user.id) // Фильтруем по client_id для безопасности
                .single();

            if (error) {
                console.error('[BookingDetailsScreen] Error fetching booking:', error);
                throw error;
            }
            
            if (!data) {
                throw new Error('Бронирование не найдено');
            }
            
            return data as BookingDetails;
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


    const getStatusColor = (status: string) => {
        switch (status) {
            case 'confirmed':
                return '#10b981';
            case 'pending':
                return '#f59e0b';
            case 'cancelled':
                return '#ef4444';
            default:
                return '#6b7280';
        }
    };

    const getStatusText = (status: string) => {
        switch (status) {
            case 'confirmed':
                return 'Подтверждено';
            case 'pending':
                return 'Ожидает подтверждения';
            case 'cancelled':
                return 'Отменено';
            default:
                return status;
        }
    };

    const handleCancel = () => {
        Alert.alert(
            'Отменить бронирование?',
            'Вы уверены, что хотите отменить эту запись?',
            [
                { text: 'Нет', style: 'cancel' },
                {
                    text: 'Да, отменить',
                    style: 'destructive',
                    onPress: () => cancelMutation.mutate(),
                },
            ]
        );
    };

    if (isLoading) {
        return (
            <View style={styles.container}>
                <Text style={styles.loading}>Загрузка...</Text>
            </View>
        );
    }

    if (!booking) {
        return (
            <View style={styles.container}>
                <Text style={styles.error}>Бронирование не найдено</Text>
            </View>
        );
    }

    const canCancel = booking.status !== 'cancelled' && booking.status !== 'confirmed';

    return (
        <ScrollView style={styles.container}>
            <Card style={styles.card}>
                <View style={styles.header}>
                    <Text style={styles.serviceName}>
                        {booking.service?.name_ru || 'Услуга'}
                    </Text>
                    <View
                        style={[
                            styles.statusBadge,
                            { backgroundColor: getStatusColor(booking.status) },
                        ]}
                    >
                        <Text style={styles.statusText}>{getStatusText(booking.status)}</Text>
                    </View>
                </View>

                {booking.business && (
                    <View style={styles.section}>
                        <Text style={styles.label}>Бизнес</Text>
                        <Text style={styles.value}>{booking.business.name}</Text>
                        {booking.business.phones && booking.business.phones.length > 0 && (
                            <Text style={styles.phone}>{booking.business.phones[0]}</Text>
                        )}
                    </View>
                )}

                {booking.staff && (
                    <View style={styles.section}>
                        <Text style={styles.label}>Мастер</Text>
                        <Text style={styles.value}>{booking.staff.full_name}</Text>
                    </View>
                )}

                {booking.branch && (
                    <View style={styles.section}>
                        <Text style={styles.label}>Филиал</Text>
                        <Text style={styles.value}>{booking.branch.name}</Text>
                        {booking.branch.address && (
                            <Text style={styles.address}>{booking.branch.address}</Text>
                        )}
                    </View>
                )}

                <View style={styles.section}>
                    <Text style={styles.label}>Дата и время</Text>
                    <Text style={styles.value}>{formatDate(booking.start_at)}</Text>
                    <Text style={styles.time}>
                        {formatTime(booking.start_at)} - {formatTime(booking.end_at)}
                    </Text>
                    {booking.service?.duration_minutes && (
                        <Text style={styles.duration}>
                            Продолжительность: {booking.service.duration_minutes} мин.
                        </Text>
                    )}
                </View>

                {booking.service?.price && (
                    <View style={styles.section}>
                        <Text style={styles.label}>Стоимость</Text>
                        <Text style={styles.price}>{booking.service.price} сом</Text>
                    </View>
                )}
            </Card>

            {canCancel && (
                <View style={styles.actions}>
                    <Button
                        title="Отменить бронирование"
                        onPress={handleCancel}
                        variant="outline"
                        style={styles.cancelButton}
                        loading={cancelMutation.isPending}
                    />
                </View>
            )}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f9fafb',
    },
    loading: {
        textAlign: 'center',
        padding: 40,
        color: '#6b7280',
    },
    error: {
        textAlign: 'center',
        padding: 40,
        color: '#ef4444',
    },
    card: {
        margin: 20,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 24,
    },
    serviceName: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#111827',
        flex: 1,
        marginRight: 12,
    },
    statusBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
    },
    statusText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#fff',
    },
    section: {
        marginBottom: 20,
        paddingBottom: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#e5e7eb',
    },
    label: {
        fontSize: 14,
        fontWeight: '500',
        color: '#6b7280',
        marginBottom: 4,
    },
    value: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 4,
    },
    phone: {
        fontSize: 14,
        color: '#6366f1',
    },
    address: {
        fontSize: 14,
        color: '#6b7280',
    },
    time: {
        fontSize: 16,
        color: '#374151',
        marginTop: 4,
    },
    duration: {
        fontSize: 14,
        color: '#6b7280',
        marginTop: 4,
    },
    price: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#10b981',
    },
    actions: {
        padding: 20,
        paddingBottom: 40,
    },
    cancelButton: {
        borderColor: '#ef4444',
    },
});

