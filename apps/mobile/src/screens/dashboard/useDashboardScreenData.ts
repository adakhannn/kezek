import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import type { Business } from './types';

export function useDashboardScreenData() {
    const [refreshing, setRefreshing] = useState(false);
    const { user } = useAuth();

    const businessesQuery = useQuery({
        queryKey: ['my-businesses', user?.id],
        queryFn: async () => {
            if (!user?.id) return [];

            const { data, error } = await supabase
                .from('businesses')
                .select('id, name, slug, address, phones')
                .eq('owner_id', user.id)
                .eq('is_approved', true)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return (data || []) as Business[];
        },
        enabled: !!user?.id,
    });

    const ownerQuery = useQuery({
        queryKey: ['is-owner', user?.id],
        queryFn: async () => {
            if (!user?.id) return false;

            const { count, error } = await supabase
                .from('businesses')
                .select('id', { count: 'exact', head: true })
                .eq('owner_id', user.id)
                .eq('is_approved', true);

            if (error) throw error;
            return (count ?? 0) > 0;
        },
        enabled: !!user?.id,
    });

    const onRefresh = async () => {
        setRefreshing(true);
        try {
            await Promise.all([businessesQuery.refetch(), ownerQuery.refetch()]);
        } finally {
            setRefreshing(false);
        }
    };

    return {
        businesses: businessesQuery.data ?? [],
        isOwner: ownerQuery.data ?? false,
        isLoading: (businessesQuery.isLoading || ownerQuery.isLoading) && !refreshing,
        loadError: businessesQuery.error ?? ownerQuery.error,
        refreshing,
        onRefresh,
    };
}
