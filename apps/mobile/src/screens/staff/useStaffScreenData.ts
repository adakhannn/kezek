import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import type { BookingRow, StaffInfo, UpcomingBooking } from './types';

export function useStaffScreenData() {
    const [refreshing, setRefreshing] = useState(false);
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

    const bookingsQuery = useQuery<UpcomingBooking[]>({
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
            return (
                (data as BookingRow[] | null)?.map((booking) => ({
                    id: booking.id,
                    start_at: booking.start_at,
                    end_at: booking.end_at,
                    client_name: booking.client_name,
                    client_phone: booking.client_phone,
                    service: Array.isArray(booking.service)
                        ? (booking.service[0] ?? null)
                        : booking.service,
                })) ?? []
            );
        },
        enabled: !!staffQuery.data?.id,
    });

    const onRefresh = async () => {
        setRefreshing(true);
        await Promise.all([staffQuery.refetch(), bookingsQuery.refetch()]);
        setRefreshing(false);
    };

    return {
        staffInfo: staffQuery.data,
        upcomingBookings: bookingsQuery.data ?? [],
        isLoading: (staffQuery.isLoading || bookingsQuery.isLoading) && !refreshing,
        refreshing,
        onRefresh,
    };
}
