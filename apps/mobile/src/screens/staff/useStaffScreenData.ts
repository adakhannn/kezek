import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { useCurrentStaff } from '../../hooks/useCurrentStaff';
import { supabase } from '../../lib/supabase';
import type { BookingRow, UpcomingBooking } from './types';
import { ACTIVE_BOOKING_STATUSES } from '@core-domain/booking';

export function useStaffScreenData() {
    const [refreshing, setRefreshing] = useState(false);
    const currentStaff = useCurrentStaff();
    const staffId = currentStaff.staffInfo?.id;

    const bookingsQuery = useQuery<UpcomingBooking[]>({
        queryKey: ['staff-bookings', staffId],
        queryFn: async () => {
            if (!staffId) return [];

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
                .eq('staff_id', staffId)
                .in('status', [...ACTIVE_BOOKING_STATUSES])
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
        enabled: !!staffId,
    });

    const onRefresh = async () => {
        setRefreshing(true);
        try {
            await Promise.all([currentStaff.refetch(), bookingsQuery.refetch()]);
        } finally {
            setRefreshing(false);
        }
    };

    return {
        staffInfo: currentStaff.staffInfo,
        staffRecords: currentStaff.staffRecords,
        needsSelection: currentStaff.needsSelection,
        selectStaff: currentStaff.select,
        upcomingBookings: bookingsQuery.data ?? [],
        loadError: currentStaff.error ?? (bookingsQuery.error as Error | null),
        isLoading: (currentStaff.isLoading || bookingsQuery.isLoading) && !refreshing,
        refreshing,
        onRefresh,
    };
}
