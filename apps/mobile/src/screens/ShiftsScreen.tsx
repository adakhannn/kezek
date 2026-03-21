import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { RootStackParamList } from '../navigation/types';
import { formatDate } from '../utils/format';
import { formatPrice } from '../utils/format';
import Card from '../components/ui/Card';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import EmptyState from '../components/ui/EmptyState';
import { apiRequest } from '../lib/api';

type ShiftsScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Main'>;

type ShiftItem = {
    id: string;
    client_name: string;
    service_name: string;
    service_amount: number;
    consumables_amount: number;
    note: string | null;
    booking_id: string | null;
    created_at: string | null;
};

type Shift = {
    id: string;
    shift_date: string;
    status: 'open' | 'closed';
    opened_at: string | null;
    closed_at: string | null;
    total_amount: number;
    consumables_amount: number;
    master_share: number;
    salon_share: number;
    late_minutes: number;
    hours_worked: number | null;
    hourly_rate: number | null;
    guaranteed_amount: number;
    items: ShiftItem[];
};

type Stats = {
    period: 'day' | 'month' | 'year';
    dateFrom: string;
    dateTo: string;
    staffName: string;
    shiftsCount: number;
    openShiftsCount: number;
    closedShiftsCount: number;
    totalAmount: number;
    totalMaster: number;
    totalSalon: number;
    totalConsumables: number;
    totalLateMinutes: number;
    totalClients: number;
    totalBaseMasterShare?: number;
    totalGuaranteedAmount?: number;
    hasGuaranteedPayment?: boolean;
    shifts: Shift[];
};

type StaffInfo = {
    id: string;
    full_name: string;
};

export default function ShiftsScreen() {
    const navigation = useNavigation<ShiftsScreenNavigationProp>();
    const [refreshing, setRefreshing] = useState(false);
    const [period, setPeriod] = useState<'day' | 'month' | 'year'>('day');
    const [date, setDate] = useState(() => {
        const today = new Date();
        return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    });

    const { user } = useAuth();

    // Получаем информацию о сотруднике
    const { data: staffInfo, isLoading: staffLoading } = useQuery({
        queryKey: ['staff-info', user?.id],
        queryFn: async () => {
            if (!user?.id) return null;

            const { data, error } = await supabase
                .from('staff')
                .select('id, full_name')
                .eq('user_id', user.id)
                .eq('is_active', true)
                .maybeSingle();

            if (error) throw error;
            return data as StaffInfo | null;
        },
        enabled: !!user?.id,
    });

    // Получаем статистику смен
    const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useQuery({
        queryKey: ['staff-shifts-stats', staffInfo?.id, period, date],
        queryFn: async () => {
            if (!staffInfo?.id) return null;

            const response = await apiRequest<{ ok: boolean; stats: Stats }>(
                `/api/dashboard/staff/${staffInfo.id}/finance/stats?period=${period}&date=${date}`
            );

            if (!response.ok) {
                throw new Error('Failed to load shifts stats');
            }

            return response.stats;
        },
        enabled: !!staffInfo?.id,
    });

    const onRefresh = async () => {
        setRefreshing(true);
        await Promise.all([refetchStats()]);
        setRefreshing(false);
    };

    if (staffLoading || (statsLoading && !refreshing)) {
        return <LoadingSpinner message="Загрузка..." />;
    }

    if (!staffInfo) {
        return (
            <ScrollView style={styles.container}>
                <EmptyState
                    icon="briefcase"
                    title="Вы не являетесь сотрудником"
                    message="Здесь будут отображаться ваши смены после назначения сотрудником"
                />
            </ScrollView>
        );
    }

    if (!stats) {
        return (
            <ScrollView style={styles.container}>
                <EmptyState
                    icon="calendar"
                    title="Нет данных"
                    message="Не удалось загрузить статистику смен"
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
                <Text style={styles.title}>Смены и статистика</Text>
                <Text style={styles.subtitle}>{staffInfo.full_name}</Text>
            </View>

            {/* Фильтры периода */}
            <View style={styles.filters}>
                <View style={styles.periodButtons}>
                    <TouchableOpacity
                        style={[styles.periodButton, period === 'day' && styles.periodButtonActive]}
                        onPress={() => setPeriod('day')}
                    >
                        <Text style={[styles.periodButtonText, period === 'day' && styles.periodButtonTextActive]}>
                            День
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.periodButton, period === 'month' && styles.periodButtonActive]}
                        onPress={() => setPeriod('month')}
                    >
                        <Text style={[styles.periodButtonText, period === 'month' && styles.periodButtonTextActive]}>
                            Месяц
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.periodButton, period === 'year' && styles.periodButtonActive]}
                        onPress={() => setPeriod('year')}
                    >
                        <Text style={[styles.periodButtonText, period === 'year' && styles.periodButtonTextActive]}>
                            Год
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Основная статистика */}
            <View style={styles.statsGrid}>
                <Card style={styles.statCard}>
                    <Text style={styles.statLabel}>Оборот</Text>
                    <Text style={styles.statValue}>{formatPrice(stats.totalAmount)}</Text>
                </Card>

                <Card style={styles.statCard}>
                    <Text style={styles.statLabel}>Доля сотрудника</Text>
                    <Text style={[styles.statValue, styles.statValueEmployee]}>
                        {formatPrice(stats.totalMaster)}
                    </Text>
                    {stats.totalAmount > 0 && (
                        <Text style={styles.statPercent}>
                            {((stats.totalMaster / stats.totalAmount) * 100).toFixed(1)}%
                        </Text>
                    )}
                </Card>

                <Card style={styles.statCard}>
                    <Text style={styles.statLabel}>Доля бизнеса</Text>
                    <Text style={[styles.statValue, styles.statValueBusiness]}>
                        {formatPrice(stats.totalSalon)}
                    </Text>
                    {stats.totalAmount > 0 && (
                        <Text style={styles.statPercent}>
                            {((stats.totalSalon / stats.totalAmount) * 100).toFixed(1)}%
                        </Text>
                    )}
                </Card>
            </View>

            {/* Дополнительная статистика */}
            <View style={styles.additionalStats}>
                <Card style={styles.additionalStatCard}>
                    <Text style={styles.additionalStatLabel}>Смен</Text>
                    <Text style={styles.additionalStatValue}>{stats.shiftsCount}</Text>
                </Card>

                <Card style={styles.additionalStatCard}>
                    <Text style={styles.additionalStatLabel}>Расходники</Text>
                    <Text style={styles.additionalStatValue}>{formatPrice(stats.totalConsumables)}</Text>
                </Card>

                <Card style={styles.additionalStatCard}>
                    <Text style={styles.additionalStatLabel}>Опоздания</Text>
                    <Text style={styles.additionalStatValue}>{stats.totalLateMinutes} мин</Text>
                </Card>

                <Card style={styles.additionalStatCard}>
                    <Text style={styles.additionalStatLabel}>Клиентов</Text>
                    <Text style={styles.additionalStatValue}>{stats.totalClients}</Text>
                </Card>
            </View>

            {/* Список смен */}
            {stats.shifts.length > 0 ? (
                <View style={styles.shiftsSection}>
                    <Text style={styles.sectionTitle}>Смены за период</Text>
                    {stats.shifts.map((shift) => (
                        <ShiftCard key={shift.id} shift={shift} />
                    ))}
                </View>
            ) : (
                <View style={styles.emptySection}>
                    <EmptyState
                        icon="calendar"
                        title="Нет смен"
                        message="За выбранный период смен не найдено"
                    />
                </View>
            )}
        </ScrollView>
    );
}

function ShiftCard({ shift }: { shift: Shift }) {
    const [expanded, setExpanded] = useState(shift.status === 'open');

    const hasGuaranteed = shift.guaranteed_amount > 0 && 
                          shift.hourly_rate && 
                          shift.guaranteed_amount > shift.master_share;

    return (
        <Card style={styles.shiftCard}>
            <TouchableOpacity
                style={styles.shiftHeader}
                onPress={() => setExpanded(!expanded)}
                activeOpacity={0.7}
            >
                <View style={styles.shiftHeaderLeft}>
                    <View style={styles.shiftHeaderTop}>
                        <Text style={styles.shiftDate}>{formatDate(shift.shift_date)}</Text>
                        <View
                            style={[
                                styles.shiftStatusBadge,
                                shift.status === 'open' ? styles.shiftStatusOpen : styles.shiftStatusClosed,
                            ]}
                        >
                            <Text
                                style={[
                                    styles.shiftStatusText,
                                    shift.status === 'open' ? styles.shiftStatusTextOpen : styles.shiftStatusTextClosed,
                                ]}
                            >
                                {shift.status === 'open' ? 'Открыта' : 'Закрыта'}
                            </Text>
                        </View>
                        {shift.items.length > 0 && (
                            <Text style={styles.shiftClientsCount}>
                                ({shift.items.length} клиентов)
                            </Text>
                        )}
                    </View>
                    {shift.opened_at && (
                        <Text style={styles.shiftTime}>
                            Открыта: {new Date(shift.opened_at).toLocaleTimeString('ru-RU', {
                                hour: '2-digit',
                                minute: '2-digit',
                            })}
                        </Text>
                    )}
                </View>
                <View style={styles.shiftHeaderRight}>
                    <Text style={styles.shiftTotalAmount}>{formatPrice(shift.total_amount)}</Text>
                    <Text style={styles.shiftConsumables}>
                        Расходники: {formatPrice(shift.consumables_amount)}
                    </Text>
                    {hasGuaranteed ? (
                        <View style={styles.shiftFinancials}>
                            <Text style={styles.shiftMasterShareGuaranteed}>
                                Сотруднику: {formatPrice(shift.guaranteed_amount)}
                            </Text>
                            {shift.hours_worked !== null && (
                                <Text style={styles.shiftHours}>
                                    За выход: {shift.hours_worked.toFixed(1)} ч
                                </Text>
                            )}
                            <Text style={styles.shiftBaseShareStriked}>
                                Базовая: {formatPrice(shift.master_share)}
                            </Text>
                            <Text style={styles.shiftSalonShare}>
                                Бизнесу: {formatPrice(shift.salon_share)}
                            </Text>
                        </View>
                    ) : (
                        <View style={styles.shiftFinancials}>
                            <Text style={styles.shiftMasterShare}>
                                Сотруднику: {formatPrice(shift.master_share)}
                            </Text>
                            {shift.guaranteed_amount > 0 && shift.hourly_rate && (
                                <Text style={styles.shiftGuaranteed}>
                                    За выход: {formatPrice(shift.guaranteed_amount)}
                                    {shift.hours_worked !== null && (
                                        <Text> ({shift.hours_worked.toFixed(1)} ч)</Text>
                                    )}
                                </Text>
                            )}
                            <Text style={styles.shiftSalonShare}>
                                Бизнесу: {formatPrice(shift.salon_share)}
                            </Text>
                        </View>
                    )}
                </View>
            </TouchableOpacity>

            {/* Список клиентов */}
            {expanded && shift.items.length > 0 && (
                <View style={styles.shiftItems}>
                    <Text style={styles.shiftItemsTitle}>Список клиентов</Text>
                    {shift.items.map((item) => (
                        <View key={item.id} style={styles.shiftItem}>
                            <View style={styles.shiftItemLeft}>
                                {item.booking_id && (
                                    <View style={styles.bookingIndicator} />
                                )}
                                <View style={styles.shiftItemInfo}>
                                    <Text style={styles.shiftItemClient}>
                                        {item.client_name || 'Клиент не указан'}
                                    </Text>
                                    <Text style={styles.shiftItemService}>
                                        {item.service_name || '—'}
                                    </Text>
                                </View>
                            </View>
                            <View style={styles.shiftItemRight}>
                                <Text style={styles.shiftItemAmount}>
                                    {formatPrice(item.service_amount)}
                                </Text>
                                {item.consumables_amount > 0 && (
                                    <Text style={styles.shiftItemConsumables}>
                                        Расходники: {formatPrice(item.consumables_amount)}
                                    </Text>
                                )}
                                {item.created_at && (
                                    <Text style={styles.shiftItemTime}>
                                        {new Date(item.created_at).toLocaleTimeString('ru-RU', {
                                            hour: '2-digit',
                                            minute: '2-digit',
                                        })}
                                    </Text>
                                )}
                            </View>
                        </View>
                    ))}
                </View>
            )}

            {expanded && shift.items.length === 0 && (
                <View style={styles.shiftItemsEmpty}>
                    <Text style={styles.shiftItemsEmptyText}>Нет добавленных клиентов</Text>
                </View>
            )}
        </Card>
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
    filters: {
        padding: 16,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#e5e7eb',
    },
    periodButtons: {
        flexDirection: 'row',
        gap: 8,
    },
    periodButton: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
        backgroundColor: '#f3f4f6',
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    periodButtonActive: {
        backgroundColor: '#4f46e5',
        borderColor: '#4f46e5',
    },
    periodButtonText: {
        fontSize: 14,
        fontWeight: '500',
        color: '#374151',
    },
    periodButtonTextActive: {
        color: '#fff',
    },
    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        padding: 16,
        gap: 12,
    },
    statCard: {
        flex: 1,
        minWidth: '45%',
        padding: 16,
    },
    statLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: '#6b7280',
        textTransform: 'uppercase',
        marginBottom: 8,
    },
    statValue: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#111827',
    },
    statValueEmployee: {
        color: '#059669',
    },
    statValueBusiness: {
        color: '#4f46e5',
    },
    statPercent: {
        fontSize: 12,
        color: '#6b7280',
        marginTop: 4,
    },
    additionalStats: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        padding: 16,
        gap: 12,
    },
    additionalStatCard: {
        flex: 1,
        minWidth: '45%',
        padding: 12,
    },
    additionalStatLabel: {
        fontSize: 12,
        color: '#6b7280',
        marginBottom: 4,
    },
    additionalStatValue: {
        fontSize: 18,
        fontWeight: '600',
        color: '#111827',
    },
    shiftsSection: {
        padding: 16,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 16,
    },
    emptySection: {
        padding: 16,
    },
    shiftCard: {
        marginBottom: 12,
        padding: 16,
    },
    shiftHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    shiftHeaderLeft: {
        flex: 1,
    },
    shiftHeaderTop: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 4,
    },
    shiftDate: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
    },
    shiftStatusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
    },
    shiftStatusOpen: {
        backgroundColor: '#d1fae5',
    },
    shiftStatusClosed: {
        backgroundColor: '#f3f4f6',
    },
    shiftStatusText: {
        fontSize: 12,
        fontWeight: '500',
    },
    shiftStatusTextOpen: {
        color: '#059669',
    },
    shiftStatusTextClosed: {
        color: '#374151',
    },
    shiftClientsCount: {
        fontSize: 12,
        color: '#6b7280',
    },
    shiftTime: {
        fontSize: 12,
        color: '#6b7280',
        marginTop: 4,
    },
    shiftHeaderRight: {
        alignItems: 'flex-end',
        minWidth: 140,
    },
    shiftTotalAmount: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#111827',
        marginBottom: 4,
    },
    shiftConsumables: {
        fontSize: 10,
        color: '#6b7280',
        marginBottom: 4,
    },
    shiftFinancials: {
        marginTop: 4,
    },
    shiftMasterShare: {
        fontSize: 10,
        color: '#374151',
        marginBottom: 2,
    },
    shiftMasterShareGuaranteed: {
        fontSize: 10,
        color: '#059669',
        fontWeight: '600',
        marginBottom: 2,
    },
    shiftBaseShareStriked: {
        fontSize: 10,
        color: '#9ca3af',
        textDecorationLine: 'line-through',
        marginBottom: 2,
    },
    shiftGuaranteed: {
        fontSize: 10,
        color: '#6b7280',
        marginBottom: 2,
    },
    shiftHours: {
        fontSize: 10,
        color: '#d97706',
        marginBottom: 2,
    },
    shiftSalonShare: {
        fontSize: 10,
        color: '#374151',
    },
    shiftItems: {
        marginTop: 16,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: '#e5e7eb',
    },
    shiftItemsTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 12,
    },
    shiftItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        padding: 12,
        backgroundColor: '#f9fafb',
        borderRadius: 8,
        marginBottom: 8,
    },
    shiftItemLeft: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    bookingIndicator: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#10b981',
    },
    shiftItemInfo: {
        flex: 1,
    },
    shiftItemClient: {
        fontSize: 14,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 4,
    },
    shiftItemService: {
        fontSize: 12,
        color: '#374151',
    },
    shiftItemRight: {
        alignItems: 'flex-end',
        minWidth: 100,
    },
    shiftItemAmount: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#111827',
        marginBottom: 4,
    },
    shiftItemConsumables: {
        fontSize: 10,
        color: '#d97706',
        marginBottom: 4,
    },
    shiftItemTime: {
        fontSize: 10,
        color: '#6b7280',
    },
    shiftItemsEmpty: {
        marginTop: 16,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: '#e5e7eb',
    },
    shiftItemsEmptyText: {
        fontSize: 14,
        color: '#6b7280',
    },
});

