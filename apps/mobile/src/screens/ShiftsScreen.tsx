import { ScrollView, RefreshControl, Text, View } from 'react-native';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import EmptyState from '../components/ui/EmptyState';
import { apiRequest } from '../lib/api';
import { ShiftCard } from './shifts/ShiftCard';
import { ShiftsPeriodFilter } from './shifts/ShiftsPeriodFilter';
import { ShiftsStatsOverview } from './shifts/ShiftsStatsOverview';
import { styles } from './shifts/styles';
import type { StaffInfo, Stats } from './shifts/types';

export default function ShiftsScreen() {
    const [refreshing, setRefreshing] = useState(false);
    const [period, setPeriod] = useState<'day' | 'month' | 'year'>('day');
    const [date] = useState(() => {
        const today = new Date();
        return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    });

    const { user } = useAuth();

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

            <ShiftsPeriodFilter period={period} setPeriod={setPeriod} />
            <ShiftsStatsOverview stats={stats} />

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
