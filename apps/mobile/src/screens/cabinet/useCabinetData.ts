import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { apiRequest } from '../../lib/api';
import { loadOfflineBookings, saveOfflineBookings } from '../../lib/offlineBookingsStorage';
import { logDebug } from '../../lib/log';
import { supabase } from '../../lib/supabase';
import type { ClientBookingListItemDto } from '@shared-client/types';
import {
    getPastBookings,
    getUpcomingBookings,
    mapApiBookingToBooking,
    mapBookingToOfflineBooking,
    mapOfflineBookingToBooking,
} from './selectors';

export function useCabinetData() {
    const [refreshing, setRefreshing] = useState(false);
    const [isOfflineSource, setIsOfflineSource] = useState(false);
    const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);

    const { data: user } = useQuery({
        queryKey: ['user'],
        queryFn: async () => {
            const {
                data: { user },
                error,
            } = await supabase.auth.getUser();
            if (error) throw error;
            return user;
        },
    });

    const { data: bookings, isLoading, refetch } = useQuery({
        queryKey: ['bookings', user?.id],
        queryFn: async () => {
            if (!user?.id) {
                logDebug('CabinetScreen', 'No user ID, returning empty array');
                return [];
            }

            logDebug('CabinetScreen', 'Fetching bookings for user (HTTP API)', { userId: user.id });

            try {
                const data = await apiRequest<ClientBookingListItemDto[]>('/mobile/bookings');
                const rows = (data ?? []) as ClientBookingListItemDto[];
                const nowIso = new Date().toISOString();

                await saveOfflineBookings({
                    userId: user.id,
                    updatedAt: nowIso,
                    items: rows.map((booking) => mapBookingToOfflineBooking(booking, nowIso)),
                });

                setIsOfflineSource(false);
                setLastSyncAt(nowIso);

                return rows.map(mapApiBookingToBooking);
            } catch (error) {
                logDebug('CabinetScreen', 'Network error, trying to load offline bookings', error);
                const cached = await loadOfflineBookings(user.id);
                if (cached && cached.items.length > 0) {
                    setIsOfflineSource(true);
                    setLastSyncAt(cached.updatedAt);
                    return cached.items.map(mapOfflineBookingToBooking);
                }

                throw error;
            }
        },
        enabled: !!user?.id,
    });

    const now = useMemo(() => new Date(), []);
    const upcomingBookings = useMemo(() => getUpcomingBookings(bookings ?? [], now), [bookings, now]);
    const pastBookings = useMemo(() => getPastBookings(bookings ?? [], now), [bookings, now]);

    const onRefresh = async () => {
        setRefreshing(true);
        await refetch();
        setRefreshing(false);
    };

    return {
        user,
        bookings,
        isLoading,
        refreshing,
        onRefresh,
        isOfflineSource,
        lastSyncAt,
        upcomingBookings,
        pastBookings,
    };
}
