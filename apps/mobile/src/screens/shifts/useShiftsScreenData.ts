import { useCallback, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { useAuth } from '../../hooks/useAuth';
import { apiRequest } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import type { ShiftStats, StaffInfo } from './types';

export function useShiftsScreenData() {
    const [refreshing, setRefreshing] = useState(false);
    const [period, setPeriod] = useState<'day' | 'month' | 'year'>('day');
    const [date] = useState(() => {
        const today = new Date();
        return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    });

    const { user } = useAuth();

    const staffQuery = useQuery({
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

    const statsQuery = useQuery({
        queryKey: ['staff-shifts-stats', staffQuery.data?.id, period, date],
        queryFn: async () => {
            if (!staffQuery.data?.id) return null;

            const response = await apiRequest<{ ok: boolean; stats: ShiftStats }>(
                `/api/dashboard/staff/${staffQuery.data.id}/finance/stats?period=${period}&date=${date}`,
            );

            if (!response.ok) {
                throw new Error('Failed to load shifts stats');
            }

            return response.stats;
        },
        enabled: !!staffQuery.data?.id,
    });

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await statsQuery.refetch();
        setRefreshing(false);
    }, [statsQuery]);

    return {
        period,
        setPeriod,
        refreshing,
        date,
        staffInfo: staffQuery.data,
        staffLoading: staffQuery.isLoading,
        stats: statsQuery.data,
        statsLoading: statsQuery.isLoading,
        onRefresh,
    };
}
