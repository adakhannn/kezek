import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { MainTabParamList } from '../navigation/types';
import { formatDate, formatTime } from '../utils/format';
import Card from '../components/ui/Card';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import EmptyState from '../components/ui/EmptyState';

type StaffScreenNavigationProp = NativeStackNavigationProp<MainTabParamList, 'Staff'>;

type StaffInfo = {
    id: string;
    full_name: string;
    branch: {
        id: string;
        name: string;
    } | null;
    business: {
        id: string;
        name: string;
    } | null;
};

type UpcomingBooking = {
    id: string;
    start_at: string;
    end_at: string;
    service: {
        name_ru: string;
    } | null;
    client_name: string | null;
    client_phone: string | null;
};

export default function StaffScreen() {
    const navigation = useNavigation<StaffScreenNavigationProp>();
    const [refreshing, setRefreshing] = useState(false);

    const { user } = useAuth();

    const { data: staffInfo, isLoading: staffLoading, refetch: refetchStaff } = useQuery({
        queryKey: ['staff-info', user?.id],
        queryFn: async () => {
            if (!user?.id) return null;

            const { data, error } = await supabase
                .from('staff')
                .select(`
                    id,
                    full_name,
                    branch:branches(id, name),
                    business:businesses(id, name)
                `)
                .eq('user_id', user.id)
                .eq('is_active', true)
                .maybeSingle();

            if (error) throw error;
            return data as StaffInfo | null;
        },
        enabled: !!user?.id,
    });

    const { data: upcomingBookings, isLoading: bookingsLoading, refetch: refetchBookings } = useQuery({
        queryKey: ['staff-bookings', staffInfo?.id],
        queryFn: async () => {
            if (!staffInfo?.id) return [];

            const now = new Date().toISOString();

            const { data, error } = await supabase
                .from('bookings')
                .select(`
                    id,
                    start_at,
                    end_at,
                    client_name,
                    client_phone,
                    service:services(name_ru)
                `)
                .eq('staff_id', staffInfo.id)
                .in('status', ['hold', 'confirmed', 'paid'])
                .gte('start_at', now)
                .order('start_at', { ascending: true })
                .limit(10);

            if (error) throw error;
            return (data || []) as UpcomingBooking[];
        },
        enabled: !!staffInfo?.id,
    });

    const onRefresh = async () => {
        setRefreshing(true);
        await Promise.all([refetchStaff(), refetchBookings()]);
        setRefreshing(false);
    };


    if ((staffLoading || bookingsLoading) && !refreshing) {
        return <LoadingSpinner message="Загрузка..." />;
    }

    if (!staffInfo) {
        return (
            <ScrollView style={styles.container}>
                <EmptyState
                    icon="briefcase"
                    title="Вы не являетесь сотрудником"
                    message="Здесь будут отображаться ваши записи после назначения сотрудником"
                />
            </ScrollView>
        );
    }

    return (
        <ScrollView
            style={styles.container}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
            <View style={styles.header}>
                <Text style={styles.title}>Кабинет сотрудника</Text>
                <Text style={styles.subtitle}>{staffInfo.full_name}</Text>
            </View>

            {staffInfo.branch && (
                <Card style={styles.card}>
                    <Text style={styles.sectionTitle}>Филиал</Text>
                    <Text style={styles.branchName}>{staffInfo.branch.name}</Text>
                </Card>
            )}

            {staffInfo.business && (
                <Card style={styles.card}>
                    <Text style={styles.sectionTitle}>Бизнес</Text>
                    <Text style={styles.businessName}>{staffInfo.business.name}</Text>
                </Card>
            )}

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Предстоящие записи</Text>

                {upcomingBookings && upcomingBookings.length > 0 ? (
                    <View style={styles.bookingsList}>
                        {upcomingBookings.map((booking) => (
                            <Card key={booking.id} style={styles.bookingCard}>
                                <Text style={styles.bookingService}>
                                    {booking.service?.name_ru || 'Услуга'}
                                </Text>
                                {booking.client_name && (
                                    <Text style={styles.bookingClient}>
                                        Клиент: {booking.client_name}
                                    </Text>
                                )}
                                {booking.client_phone && (
                                    <Text style={styles.bookingPhone}>
                                        {booking.client_phone}
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
                        ))}
                    </View>
                ) : (
                    <EmptyState
                        icon="calendar"
                        title="Нет предстоящих записей"
                        message="Записи появятся здесь, когда клиенты запишутся к вам"
                    />
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
    card: {
        margin: 20,
        marginBottom: 0,
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
    branchName: {
        fontSize: 18,
        fontWeight: '500',
        color: '#374151',
    },
    businessName: {
        fontSize: 18,
        fontWeight: '500',
        color: '#374151',
    },
    bookingsList: {
        gap: 12,
    },
    bookingCard: {
        marginBottom: 12,
    },
    bookingService: {
        fontSize: 18,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 8,
    },
    bookingClient: {
        fontSize: 14,
        color: '#374151',
        marginBottom: 4,
    },
    bookingPhone: {
        fontSize: 14,
        color: '#6366f1',
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
});
