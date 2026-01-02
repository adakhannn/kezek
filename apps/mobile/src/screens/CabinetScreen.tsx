import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { supabase } from '../lib/supabase';
import { CabinetStackParamList } from '../navigation/types';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';

type CabinetScreenNavigationProp = NativeStackNavigationProp<CabinetStackParamList, 'CabinetMain'>;

type Booking = {
    id: string;
    start_at: string;
    end_at: string;
    status: string;
    service: {
        name_ru: string;
    } | null;
    staff: {
        name_ru: string;
    } | null;
    branch: {
        name_ru: string;
        address: string;
    } | null;
    business: {
        name: string;
    } | null;
};

export default function CabinetScreen() {
    const navigation = useNavigation<CabinetScreenNavigationProp>();
    const [refreshing, setRefreshing] = useState(false);

    const { data: user } = useQuery({
        queryKey: ['user'],
        queryFn: async () => {
            const { data: { user }, error } = await supabase.auth.getUser();
            if (error) throw error;
            return user;
        },
    });

    const { data: bookings, isLoading, refetch } = useQuery({
        queryKey: ['bookings', user?.id],
        queryFn: async () => {
            if (!user?.id) return [];

            const { data, error } = await supabase
                .from('bookings')
                .select(`
                    id,
                    start_at,
                    end_at,
                    status,
                    service:services(name_ru),
                    staff:staff(name_ru),
                    branch:branches(name_ru, address),
                    business:businesses(name)
                `)
                .eq('client_id', user.id)
                .order('start_at', { ascending: false })
                .limit(50);

            if (error) throw error;
            return data as Booking[];
        },
        enabled: !!user?.id,
    });

    const onRefresh = async () => {
        setRefreshing(true);
        await refetch();
        setRefreshing(false);
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('ru-RU', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
        });
    };

    const formatTime = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleTimeString('ru-RU', {
            hour: '2-digit',
            minute: '2-digit',
        });
    };

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
                return 'Ожидает';
            case 'cancelled':
                return 'Отменено';
            default:
                return status;
        }
    };

    const handleBookingPress = (bookingId: string) => {
        // @ts-ignore - типы навигации будут исправлены позже
        navigation.navigate('BookingDetails', { id: bookingId });
    };


    if (isLoading) {
        return (
            <View style={styles.container}>
                <Text style={styles.loading}>Загрузка...</Text>
            </View>
        );
    }

    return (
        <ScrollView
            style={styles.container}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
            <View style={styles.header}>
                <Text style={styles.title}>Личный кабинет</Text>
                {user && (
                    <Text style={styles.subtitle}>
                        {user.email || user.phone || 'Пользователь'}
                    </Text>
                )}
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Мои записи</Text>

                {bookings && bookings.length > 0 ? (
                    <View style={styles.bookingsList}>
                        {bookings.map((booking) => (
                            <TouchableOpacity
                                key={booking.id}
                                onPress={() => handleBookingPress(booking.id)}
                            >
                                <Card style={styles.bookingCard}>
                                    <View style={styles.bookingHeader}>
                                        <Text style={styles.bookingService}>
                                            {booking.service?.name_ru || 'Услуга'}
                                        </Text>
                                        <View
                                            style={[
                                                styles.statusBadge,
                                                { backgroundColor: getStatusColor(booking.status) },
                                            ]}
                                        >
                                            <Text style={styles.statusText}>
                                                {getStatusText(booking.status)}
                                            </Text>
                                        </View>
                                    </View>

                                    {booking.business && (
                                        <Text style={styles.bookingBusiness}>
                                            {booking.business.name}
                                        </Text>
                                    )}

                                    {booking.staff && (
                                        <Text style={styles.bookingStaff}>
                                            Мастер: {booking.staff.name_ru}
                                        </Text>
                                    )}

                                    {booking.branch && (
                                        <Text style={styles.bookingBranch}>
                                            {booking.branch.name_ru}
                                            {booking.branch.address && ` • ${booking.branch.address}`}
                                        </Text>
                                    )}

                                    <View style={styles.bookingTime}>
                                        <Text style={styles.bookingDate}>
                                            {formatDate(booking.start_at)}
                                        </Text>
                                        <Text style={styles.bookingTimeRange}>
                                            {formatTime(booking.start_at)} - {formatTime(booking.end_at)}
                                        </Text>
                                    </View>
                                </Card>
                            </TouchableOpacity>
                        ))}
                    </View>
                ) : (
                    <View style={styles.empty}>
                        <Text style={styles.emptyText}>У вас пока нет записей</Text>
                        <Text style={styles.emptyHint}>Запишитесь на услугу, чтобы увидеть её здесь</Text>
                    </View>
                )}
            </View>

            <View style={styles.footer}>
                <Button
                    title="Профиль"
                    onPress={() => navigation.navigate('Profile')}
                    variant="outline"
                />
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f9fafb',
    },
    header: {
        padding: 20,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#e5e7eb',
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#111827',
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 16,
        color: '#6b7280',
    },
    section: {
        padding: 20,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 16,
    },
    bookingsList: {
        gap: 12,
    },
    bookingCard: {
        marginBottom: 12,
    },
    bookingHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 8,
    },
    bookingService: {
        fontSize: 18,
        fontWeight: '600',
        color: '#111827',
        flex: 1,
        marginRight: 8,
    },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
    },
    statusText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#fff',
    },
    bookingBusiness: {
        fontSize: 16,
        fontWeight: '500',
        color: '#374151',
        marginBottom: 4,
    },
    bookingStaff: {
        fontSize: 14,
        color: '#6b7280',
        marginBottom: 4,
    },
    bookingBranch: {
        fontSize: 14,
        color: '#6b7280',
        marginBottom: 8,
    },
    bookingTime: {
        marginTop: 8,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#e5e7eb',
    },
    bookingDate: {
        fontSize: 14,
        fontWeight: '500',
        color: '#111827',
        marginBottom: 4,
    },
    bookingTimeRange: {
        fontSize: 14,
        color: '#6b7280',
    },
    loading: {
        textAlign: 'center',
        padding: 40,
        color: '#6b7280',
    },
    empty: {
        padding: 40,
        alignItems: 'center',
    },
    emptyText: {
        fontSize: 18,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 8,
    },
    emptyHint: {
        fontSize: 14,
        color: '#6b7280',
    },
    footer: {
        padding: 20,
        paddingBottom: 40,
    },
});
