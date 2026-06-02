import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { apiRequest } from '../../lib/api';
import { logDebug } from '../../lib/log';
import { loadOfflineBookings, saveOfflineBookings, type OfflineBooking } from '../../lib/offlineBookingsStorage';
import { supabase } from '../../lib/supabase';
import type { ClientBookingListItemDto } from '@shared-client/types';
import { mapClientBookingListItemToBooking, type Booking } from './types';

type ApiEnvelope<T> = {
    ok?: boolean;
    data?: T;
};

function unwrapBookings(payload: ClientBookingListItemDto[] | ApiEnvelope<ClientBookingListItemDto[]>): ClientBookingListItemDto[] {
    if (Array.isArray(payload)) {
        return payload;
    }

    if (payload && typeof payload === 'object' && Array.isArray(payload.data)) {
        return payload.data;
    }

    return [];
}

export function useCabinetScreenData() {
    const [refreshing, setRefreshing] = useState(false);
    const [activeTab, setActiveTab] = useState<'upcoming' | 'history'>('upcoming');
    const [isOfflineData, setIsOfflineData] = useState(false);
    const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);

    const userQuery = useQuery({
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

    const bookingsQuery = useQuery({
        queryKey: ['bookings', userQuery.data?.id],
        queryFn: async () => {
            if (!userQuery.data?.id) {
                logDebug('CabinetScreen', 'No user ID, returning empty array');
                return [];
            }

            try {
                const data = await apiRequest<ClientBookingListItemDto[] | ApiEnvelope<ClientBookingListItemDto[]>>(
                    '/mobile/bookings',
                );
                const rows = unwrapBookings(data);
                const nowIso = new Date().toISOString();
                const offlineItems: OfflineBooking[] = rows.map((b) => ({
                    id: String(b.id),
                    status: b.status as OfflineBooking['status'],
                    start_at: String(b.start_at),
                    end_at: String(b.end_at),
                    branch_name: b.branch?.name ?? null,
                    service_name: b.service?.name_ru ?? null,
                    staff_name: b.staff?.full_name ?? null,
                    business_name: b.business?.name ?? null,
                    created_at: nowIso,
                }));

                await saveOfflineBookings({
                    userId: userQuery.data.id,
                    updatedAt: nowIso,
                    items: offlineItems,
                });

                setIsOfflineData(false);
                setLastSyncAt(nowIso);
                logDebug('CabinetScreen', 'Bookings loaded', { count: rows.length || 0 });
                return rows.map(mapClientBookingListItemToBooking);
            } catch (error) {
                logDebug('CabinetScreen', 'Network error, trying to load offline bookings', error);
                const cached = await loadOfflineBookings(userQuery.data.id);
                if (cached && cached.items.length > 0) {
                    setIsOfflineData(true);
                    setLastSyncAt(cached.updatedAt);

                    return cached.items.map(
                        (item) =>
                            ({
                                id: item.id,
                                start_at: item.start_at,
                                end_at: item.end_at,
                                status: item.status,
                                service: item.service_name ? { name_ru: item.service_name } : null,
                                staff: item.staff_name ? { full_name: item.staff_name } : null,
                                branch: item.branch_name ? { name: item.branch_name, address: '' } : null,
                                business: item.business_name ? { name: item.business_name } : null,
                            }) as Booking,
                    );
                }

                throw error;
            }
        },
        enabled: !!userQuery.data?.id,
    });

    const onRefresh = async () => {
        setRefreshing(true);
        await bookingsQuery.refetch();
        setRefreshing(false);
    };

    const now = useMemo(() => new Date(), []);

    const upcomingBookings = useMemo(() => {
        const bookings = bookingsQuery.data ?? [];
        return bookings.filter((b) => {
            if (b.status === 'cancelled') return false;
            return new Date(b.end_at) >= now;
        });
    }, [bookingsQuery.data, now]);

    const pastBookings = useMemo(() => {
        const bookings = bookingsQuery.data ?? [];
        return bookings.filter((b) => {
            const end = new Date(b.end_at);
            return end < now || b.status === 'cancelled';
        });
    }, [bookingsQuery.data, now]);

    return {
        user: userQuery.data,
        bookings: bookingsQuery.data,
        isLoading: bookingsQuery.isLoading,
        refreshing,
        activeTab,
        setActiveTab,
        isOfflineData,
        lastSyncAt,
        upcomingBookings,
        pastBookings,
        onRefresh,
    };
}
