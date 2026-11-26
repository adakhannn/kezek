import { useCallback, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { useCurrentStaff } from '../../hooks/useCurrentStaff';
import { apiRequest } from '../../lib/api';
import type { ShiftStats, StaffInfo } from './types';

export function useShiftsScreenData() {
    const [refreshing, setRefreshing] = useState(false);
    const [period, setPeriod] = useState<'day' | 'month' | 'year'>('day');
    const [date, setDate] = useState(() => {
        const today = new Date();
        return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    });

    const currentStaff = useCurrentStaff();
    const staffInfo: StaffInfo | null = currentStaff.staffInfo;
    const staffId = staffInfo?.id;
    const queryDate = period === 'day' ? date : period === 'month' ? date.slice(0, 7) : date.slice(0, 4);

    const statsQuery = useQuery({
        queryKey: ['staff-shifts-stats', staffId, period, queryDate],
        queryFn: async () => {
            if (!staffId) return null;

            // The staff card is in the path, so this request needs no staff card header.
            const response = await apiRequest<{ ok: boolean; data: { stats: ShiftStats } }>(
                `/api/dashboard/staff/${staffId}/finance/stats?period=${period}&date=${queryDate}`,
            );

            if (!response.ok) {
                throw new Error('Failed to load shifts stats');
            }

            return response.data.stats;
        },
        enabled: !!staffId,
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
        setDate,
        staffInfo,
        statsFetching: statsQuery.isFetching,
        refetch: () => void statsQuery.refetch(),
        staffLoading: currentStaff.isLoading,
        needsSelection: currentStaff.needsSelection,
        stats: statsQuery.data,
        statsLoading: statsQuery.isLoading,
        statsError: statsQuery.error,
        onRefresh,
    };
}
