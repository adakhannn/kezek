import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import type { Business } from './types';

export function useDashboardScreen() {
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

            const { count } = await supabase
                .from('businesses')
                .select('id', { count: 'exact', head: true })
                .eq('owner_id', user.id)
                .eq('is_approved', true);

            return (count ?? 0) > 0;
        },
        enabled: !!user?.id,
    });

    const handleRefresh = async () => {
        setRefreshing(true);
        await Promise.all([businessesQuery.refetch(), ownerQuery.refetch()]);
        setRefreshing(false);
    };

    return {
        refreshing,
        businesses: businessesQuery.data || [],
        isLoading: businessesQuery.isLoading,
        isOwner: ownerQuery.data ?? false,
        handleRefresh,
    };
}
