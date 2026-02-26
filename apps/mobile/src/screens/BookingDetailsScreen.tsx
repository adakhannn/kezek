import { View, Text, StyleSheet, ScrollView, Alert, Linking } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { supabase } from '../lib/supabase';
import { apiRequest } from '../lib/api';
import { useToast } from '../contexts/ToastContext';
import { formatDate, formatTime, formatPhone } from '../utils/format';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { logError } from '../lib/log';
import { RootStackParamList } from '../navigation/types';
import { getStatusColor, getStatusText } from '../utils/i18n';

type BookingDetailsRouteParams = {
    id: string;
};

type BookingDetailsScreenRouteProp = RouteProp<{ params: BookingDetailsRouteParams }, 'params'>;
type BookingDetailsScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;

type BookingDetails = {
    id: string;
    start_at: string;
    end_at: string;
    status: string;
    service: {
        name_ru: string;
        duration_min: number;
        price_from: number | null;
        price_to: number | null;
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
        slug?: string;
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
                    service:services(name_ru, duration_min, price_from, price_to),
                    staff:staff(full_name),
                    branch:branches(name, address),
                    business:businesses(name, slug, phones)
                `)
                .eq('id', bookingId)
                .eq('client_id', user.id) // Фильтруем по client_id для безопасности
                .single();

            if (error) {
                logError('BookingDetailsScreen', 'Error fetching booking', error);
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

    const primaryPhone = booking?.business?.phones?.[0] || null;

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
        const url = `https://wa.me/${digits}`;
        Linking.openURL(url).catch(() => {
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

    const timelineSteps = [
        { key: 'created', label: 'Создано', done: true },
        {
            key: 'confirmed',
            label: 'Подтверждено',
            done: booking.status === 'confirmed' || booking.status === 'paid',
        },
        {
            key: 'completed',
            label: booking.status === 'cancelled' ? 'Отменено' : 'Завершено',
            done: booking.status === 'paid' || booking.status === 'cancelled',
        },
        {
            key: 'promo',
            label: 'Промо применено',
            done: false, // TODO: можно расширить, когда промо будет доступно в запросе
        },
    ] as const;

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

                <View style={styles.timelineSection}>
                    <Text style={styles.label}>Статус</Text>
                    <View style={styles.timelineRow}>
                        {timelineSteps.map((step, index) => (
                            <View key={step.key} style={styles.timelineStep}>
                                <View
                                    style={[
                                        styles.timelineDot,
                                        step.done && styles.timelineDotDone,
                                    ]}
                                >
                                    {step.done && (
                                        <Text style={styles.timelineDotText}>✓</Text>
                                    )}
                                </View>
                                <Text style={styles.timelineLabel}>{step.label}</Text>
                                {index < timelineSteps.length - 1 && (
                                    <View style={styles.timelineConnector} />
                                )}
                            </View>
                        ))}
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={styles.label}>Дата и время</Text>
                    <Text style={styles.value}>{formatDate(booking.start_at)}</Text>
                    <Text style={styles.time}>
                        {formatTime(booking.start_at)} - {formatTime(booking.end_at)}
                    </Text>
                    {booking.service?.duration_min && (
                        <Text style={styles.duration}>
                            Продолжительность: {booking.service.duration_min} мин.
                        </Text>
                    )}
                </View>

                {booking.service && (booking.service.price_from || booking.service.price_to) && (
                    <View style={styles.section}>
                        <Text style={styles.label}>Стоимость</Text>
                        <Text style={styles.price}>
                            {booking.service.price_from && booking.service.price_to
                                ? `${booking.service.price_from} - ${booking.service.price_to} сом`
                                : booking.service.price_from
                                ? `от ${booking.service.price_from} сом`
                                : booking.service.price_to
                                ? `до ${booking.service.price_to} сом`
                                : ''}
                        </Text>
                    </View>
                )}
            </Card>

            <View style={styles.actions}>
                <Button
                    title="Повторить запись"
                    onPress={handleRepeat}
                    style={styles.primaryAction}
                />

                {canCancel && (
                    <Button
                        title="Отменить бронирование"
                        onPress={handleCancel}
                        variant="outline"
                        style={styles.cancelButton}
                        loading={cancelMutation.isPending}
                    />
                )}

                {primaryPhone && (
                    <View style={styles.contactRow}>
                        <Button
                            title="Позвонить в салон"
                            onPress={handleCall}
                            variant="outline"
                            style={styles.contactButton}
                        />
                        <Button
                            title="Написать в WhatsApp"
                            onPress={handleWhatsApp}
                            variant="outline"
                            style={styles.contactButton}
                        />
                    </View>
                )}
            </View>
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
    timelineSection: {
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
    timelineRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8,
        columnGap: 4,
    },
    timelineStep: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    timelineDot: {
        width: 18,
        height: 18,
        borderRadius: 9,
        borderWidth: 1,
        borderColor: '#d1d5db',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#fff',
    },
    timelineDotDone: {
        backgroundColor: '#4f46e5',
        borderColor: '#4f46e5',
    },
    timelineDotText: {
        fontSize: 10,
        color: '#fff',
        fontWeight: '700',
    },
    timelineLabel: {
        fontSize: 11,
        color: '#6b7280',
        marginLeft: 4,
        marginRight: 4,
    },
    timelineConnector: {
        width: 16,
        height: 1,
        backgroundColor: '#e5e7eb',
    },
    actions: {
        padding: 20,
        paddingBottom: 40,
        gap: 12,
    },
    primaryAction: {
        marginBottom: 4,
    },
    cancelButton: {
        borderColor: '#ef4444',
    },
    contactRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 8,
    },
    contactButton: {
        flex: 1,
    },
});

