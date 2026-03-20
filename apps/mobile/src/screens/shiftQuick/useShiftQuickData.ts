import { useQuery } from '@tanstack/react-query';

import { supabase } from '../../lib/supabase';
import { apiRequest } from '../../lib/api';
import { logDebug } from '../../lib/log';
import { getShiftCache, saveShiftCache } from './storage';
import type { FinanceData } from './types';

type Options = {
    userId?: string;
};

export function useShiftQuickData({ userId }: Options) {
    const staffInfoQuery = useQuery({
        queryKey: ['staff-info', userId],
        queryFn: async () => {
            if (!userId) return null;

            const { data, error } = await supabase
                .from('staff')
                .select('id, full_name')
                .eq('user_id', userId)
                .eq('is_active', true)
                .maybeSingle();

            if (error) throw error;
            return data as { id: string; full_name: string } | null;
        },
        enabled: !!userId,
    });

    const financeDataQuery = useQuery({
        queryKey: ['staff-finance', staffInfoQuery.data?.id],
        queryFn: async () => {
            if (!staffInfoQuery.data?.id) return null;

            try {
                const response = await apiRequest<{ ok: boolean; data: FinanceData }>(
                    `/api/staff/finance`
                );

                if (!response.ok) {
                    throw new Error('Failed to load shift data');
                }

                await saveShiftCache(response.data);
                return response.data;
            } catch (error) {
                logDebug('ShiftQuickScreen', 'Network error, loading from cache', error);
                const cached = await getShiftCache();
                if (cached) {
                    return cached;
                }
                throw error;
            }
        },
        enabled: !!staffInfoQuery.data?.id,
        retry: 1,
        staleTime: 5 * 1000,
    });

    return {
        staffInfo: staffInfoQuery.data,
        staffInfoQuery,
        financeData: financeDataQuery.data,
        financeDataQuery,
    };
}
