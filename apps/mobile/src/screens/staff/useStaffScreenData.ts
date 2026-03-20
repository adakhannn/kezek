import { useQuery } from '@tanstack/react-query';

import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import type { StaffInfo, UpcomingBooking } from './types';

export function useStaffScreenData() {
    const { user } = useAuth();

    const staffQuery = useQuery({
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

    const bookingsQuery = useQuery({
        queryKey: ['staff-bookings', staffQuery.data?.id],
        queryFn: async () => {
            if (!staffQuery.data?.id) return [];

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
                .eq('staff_id', staffQuery.data.id)
                .in('status', ['hold', 'confirmed', 'paid'])
                .gte('start_at', now)
                .order('start_at', { ascending: true })
                .limit(10);

            if (error) throw error;
            return (data || []) as UpcomingBooking[];
        },
        enabled: !!staffQuery.data?.id,
    });

    return {
        user,
        staffInfo: staffQuery.data,
        upcomingBookings: bookingsQuery.data,
        staffLoading: staffQuery.isLoading,
        bookingsLoading: bookingsQuery.isLoading,
        refetchStaff: staffQuery.refetch,
        refetchBookings: bookingsQuery.refetch,
    };
}
