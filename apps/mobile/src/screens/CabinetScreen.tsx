import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { supabase } from '../lib/supabase';
import { CabinetStackParamList, RootStackParamList } from '../navigation/types';
import { formatDate, formatTime } from '../utils/format';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { logError, logDebug } from '../lib/log';
import { getStatusColor, getStatusText } from '../utils/i18n';
import {
    loadOfflineBookings,
    saveOfflineBookings,
    type OfflineBooking,
} from '../lib/offlineBookingsStorage';

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
        full_name: string;
    } | null;
    branch: {
        name: string;
        address: string;
    } | null;
    business: {
        name: string;
    } | null;
};

export default function CabinetScreen() {
    const navigation = useNavigation<CabinetScreenNavigationProp>();
    const [refreshing, setRefreshing] = useState(false);
    const [isOfflineData, setIsOfflineData] = useState(false);
    const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);

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
            if (!user?.id) {
                logDebug('CabinetScreen', 'No user ID, returning empty array');
                return [];
            }

            logDebug('CabinetScreen', 'Fetching bookings for user', { userId: user.id });

            try {
                const { data, error } = await supabase
                    .from('bookings')
                    .select(`
                        id,
                        start_at,
                        end_at,
                        status,
                        service:services(name_ru),
                        staff:staff(full_name),
                        branch:branches(name, address),
                        business:businesses(name)
                    `)
                    .eq('client_id', user.id)
                    .order('start_at', { ascending: false })
                    .limit(50);

                if (error) {
                    logError('CabinetScreen', 'Error fetching bookings', error);
                    throw error;
                }

                const rows = (data as any[]) ?? [];
                const nowIso = new Date().toISOString();
                const offlineItems: OfflineBooking[] = rows.map((b) => {
                    const branch = (b.branch && Array.isArray(b.branch) ? b.branch[0] : b.branch) as
                        | { name?: string | null; address?: string | null }
                        | null
                        | undefined;
                    const service = (b.service && Array.isArray(b.service) ? b.service[0] : b.service) as
                        | { name_ru?: string | null }
                        | null
                        | undefined;
                    const staff = (b.staff && Array.isArray(b.staff) ? b.staff[0] : b.staff) as
                        | { full_name?: string | null }
                        | null
                        | undefined;
                    const business = (b.business && Array.isArray(b.business) ? b.business[0] : b.business) as
                        | { name?: string | null }
                        | null
                        | undefined;

                    return {
                        id: String(b.id),
                        status: b.status as OfflineBooking['status'],
                        start_at: String(b.start_at),
                        end_at: String(b.end_at),
                        branch_name: branch?.name ?? null,
                        service_name: service?.name_ru ?? null,
                        staff_name: staff?.full_name ?? null,
                        business_name: business?.name ?? null,
                        created_at: nowIso,
                    };
                });

                await saveOfflineBookings({
                    userId: user.id,
                    updatedAt: nowIso,
                    items: offlineItems,
                });

                setIsOfflineData(false);
                setLastSyncAt(nowIso);

                logDebug('CabinetScreen', 'Bookings loaded', { count: rows.length || 0 });
                return rows as unknown as Booking[];
            } catch (error) {
                logDebug('CabinetScreen', 'Network error, trying to load offline bookings', error);
                const cached = await loadOfflineBookings(user.id);
                if (cached && cached.items.length > 0) {
                    setIsOfflineData(true);
                    setLastSyncAt(cached.updatedAt);

                    return cached.items.map((item) => ({
                        id: item.id,
                        start_at: item.start_at,
                        end_at: item.end_at,
                        status: item.status,
                        service: item.service_name ? { name_ru: item.service_name } : null,
                        staff: item.staff_name ? { full_name: item.staff_name } : null,
                        branch: item.branch_name
                            ? { name: item.branch_name, address: '' }
                            : null,
                        business: item.business_name ? { name: item.business_name } : null,
                    })) as Booking[];
                }

                // Если кэша нет — пробрасываем ошибку дальше
                throw error;
            }
        },
        enabled: !!user?.id,
    });

    const onRefresh = async () => {
        setRefreshing(true);
        await refetch();
        setRefreshing(false);
    };



    const handleBookingPress = (bookingId: string) => {
        // Навигация в BookingDetails находится в RootStack, поэтому используем type assertion
        (navigation as unknown as { navigate: (screen: keyof RootStackParamList, params?: RootStackParamList[keyof RootStackParamList]) => void }).navigate('BookingDetails', { id: bookingId });
    };


    const now = useMemo(() => new Date(), []);
    const upcomingBookings: Booking[] = useMemo(() => {
        if (!bookings) return [];
        return bookings.filter((b) => {
            if (b.status === 'cancelled') return false;
            const end = new Date(b.end_at);
            return end >= now;
        });
    }, [bookings, now]);

    const pastBookings: Booking[] = useMemo(() => {
        if (!bookings) return [];
        return bookings.filter((b) => {
            const end = new Date(b.end_at);
            return end < now || b.status === 'cancelled';
        });
    }, [bookings, now]);

    if (isLoading && !bookings) {
        return (
            <View style={styles.container} testID="cabinet-screen">
                <Text style={styles.loading}>Загрузка...</Text>
            </View>
        );
    }

    return (
        <ScrollView
            style={styles.container}
            testID="cabinet-screen"
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

                <View style={styles.tabsContainer}>
                    <TouchableOpacity
                        style={[styles.tabButton, !isOfflineData && styles.tabButtonActive]}
                        onPress={() => {
                            setIsOfflineData(false);
                        }}
                    >
                        <Text
                            style={[
                                styles.tabButtonText,
                                !isOfflineData && styles.tabButtonTextActive,
                            ]}
                        >
                            Предстоящие
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tabButton, isOfflineData && styles.tabButtonActive]}
                        onPress={() => {
                            setIsOfflineData(true);
                        }}
                    >
                        <Text
                            style={[
                                styles.tabButtonText,
                                isOfflineData && styles.tabButtonTextActive,
                            ]}
                        >
                            История
                        </Text>
                    </TouchableOpacity>
                </View>

                {isOfflineData && (
                    <View style={styles.offlineBanner}>
                        <Text style={styles.offlineBannerText}>
                            Нет подключения к интернету — показаны сохранённые данные
                            {lastSyncAt ? ` (последняя синхронизация: ${formatDate(lastSyncAt)} ${formatTime(lastSyncAt)})` : ''}
                        </Text>
                    </View>
                )}

                {!isOfflineData && upcomingBookings.length > 0 ? (
                    <View style={styles.bookingsList}>
                        {upcomingBookings.map((booking) => (
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
                                            Мастер: {booking.staff.full_name}
                                        </Text>
                                    )}

                                    {booking.branch && (
                                        <Text style={styles.bookingBranch}>
                                            {booking.branch.name}
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
                ) : !isOfflineData && (
                    <View style={styles.empty}>
                        <Text style={styles.emptyText}>У вас пока нет записей</Text>
                        <Text style={styles.emptyHint}>Запишитесь на услугу, чтобы увидеть её здесь</Text>
                    </View>
                )}

                {isOfflineData && pastBookings.length > 0 && (
                    <View style={styles.bookingsList}>
                        {pastBookings.map((booking) => (
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
                                            Мастер: {booking.staff.full_name}
                                        </Text>
                                    )}

                                    {booking.branch && (
                                        <Text style={styles.bookingBranch}>
                                            {booking.branch.name}
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
                )}

                {isOfflineData && pastBookings.length === 0 && (
                    <View style={styles.empty}>
                        <Text style={styles.emptyText}>У вас пока нет прошедших записей</Text>
                        <Text style={styles.emptyHint}>
                            Здесь появятся завершённые записи после первой синхронизации
                        </Text>
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
        padding: 24,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#e5e7eb',
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#111827',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        color: '#6b7280',
    },
    section: {
        padding: 24,
    },
    sectionTitle: {
        fontSize: 24,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 20,
    },
    tabsContainer: {
        flexDirection: 'row',
        backgroundColor: '#f3f4f6',
        borderRadius: 999,
        padding: 4,
        marginBottom: 12,
    },
    tabButton: {
        flex: 1,
        paddingVertical: 8,
        borderRadius: 999,
        alignItems: 'center',
        justifyContent: 'center',
    },
    tabButtonActive: {
        backgroundColor: '#ffffff',
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 1,
    },
    tabButtonText: {
        fontSize: 14,
        color: '#6b7280',
        fontWeight: '500',
    },
    tabButtonTextActive: {
        color: '#4f46e5',
        fontWeight: '600',
    },
    offlineBanner: {
        marginBottom: 16,
        padding: 12,
        borderRadius: 8,
        backgroundColor: '#FEF3C7',
        borderWidth: 1,
        borderColor: '#FBBF24',
    },
    offlineBannerText: {
        fontSize: 14,
        color: '#92400E',
    },
    bookingsList: {
        gap: 16,
    },
    bookingCard: {
        marginBottom: 0,
    },
    bookingHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    bookingService: {
        fontSize: 20,
        fontWeight: '600',
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
    bookingBusiness: {
        fontSize: 16,
        fontWeight: '500',
        color: '#374151',
        marginBottom: 6,
    },
    bookingStaff: {
        fontSize: 14,
        color: '#6b7280',
        marginBottom: 6,
    },
    bookingBranch: {
        fontSize: 14,
        color: '#6b7280',
        marginBottom: 12,
    },
    bookingTime: {
        marginTop: 12,
        paddingTop: 12,
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
        padding: 24,
        paddingBottom: 40,
    },
});
