import { useMemo, useState } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { useNow } from '../../hooks/useNow';
import { apiRequest } from '../../lib/api';
import { logDebug } from '../../lib/log';
import { loadOfflineBookings, saveOfflineBookings, type OfflineBooking } from '../../lib/offlineBookingsStorage';
import { supabase } from '../../lib/supabase';
import type { ClientBookingListItemDto, ClientBookingsPageDto } from '@shared-client/types';
import { mapClientBookingListItemToBooking, type Booking } from './types';

type ApiEnvelope<T> = {
    ok?: boolean;
    data?: T;
    page?: ClientBookingsPageDto;
};

/** Bookings per page of GET /api/mobile/bookings (B11: the history was capped at 50). */
export const CABINET_PAGE_SIZE = 50;

type BookingsPage = {
    items: Booking[];
    /** Offset of the next page; null when this is the last (or an older server sent no paging). */
    nextOffset: number | null;
    offline: boolean;
    syncedAt: string | null;
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

function nextOffsetOf(payload: unknown): number | null {
    const page = (payload as ApiEnvelope<unknown> | null)?.page;
    return page?.has_more && typeof page.next_offset === 'number' ? page.next_offset : null;
}

function offlineItemToBooking(item: OfflineBooking): Booking {
    return {
        id: item.id,
        start_at: item.start_at,
        end_at: item.end_at,
        status: item.status,
        service: item.service_name
            ? { name_ru: item.service_name, name_ky: item.service_name_ky ?? null, name_en: item.service_name_en ?? null }
            : null,
        staff: item.staff_name ? { full_name: item.staff_name } : null,
        branch: item.branch_name ? { name: item.branch_name, address: '' } : null,
        business: item.business_name ? { name: item.business_name, tz: item.business_tz ?? null } : null,
    };
}

async function loadBookingsPage(userId: string, offset: number): Promise<BookingsPage> {
    try {
        const data = await apiRequest<ClientBookingListItemDto[] | ApiEnvelope<ClientBookingListItemDto[]>>(
            `/mobile/bookings?limit=${CABINET_PAGE_SIZE}&offset=${offset}`,
        );
        const rows = unwrapBookings(data);
        const nowIso = new Date().toISOString();

        // The offline copy is the first page: upcoming visits and the latest history.
        if (offset === 0) {
            const offlineItems: OfflineBooking[] = rows.map((b) => ({
                id: String(b.id),
                status: b.status as OfflineBooking['status'],
                start_at: String(b.start_at),
                end_at: String(b.end_at),
                branch_name: b.branch?.name ?? null,
                service_name: b.service?.name_ru ?? null,
                service_name_ky: b.service?.name_ky ?? null,
                service_name_en: b.service?.name_en ?? null,
                staff_name: b.staff?.full_name ?? null,
                business_name: b.business?.name ?? null,
                business_tz: b.business?.tz ?? null,
                created_at: nowIso,
            }));

            await saveOfflineBookings({
                userId,
                updatedAt: nowIso,
                items: offlineItems,
            });
        }

        logDebug('CabinetScreen', 'Bookings loaded', { count: rows.length || 0, offset });
        return {
            items: rows.map(mapClientBookingListItemToBooking),
            nextOffset: nextOffsetOf(data),
            offline: false,
            syncedAt: nowIso,
        };
    } catch (error) {
        // Offline data is for a lost connection or a failing server, not for an answer such as
        // 401/403/404: showing the cache as "offline" would hide the real problem. Later pages
        // have no copy: their failure is shown under the list with a retry.
        const status = (error as { status?: unknown } | null)?.status;
        if (offset > 0 || (typeof status === 'number' && status > 0 && status < 500)) {
            throw error;
        }
        logDebug('CabinetScreen', 'Network error, trying to load offline bookings', error);
        const cached = await loadOfflineBookings(userId);
        if (cached && cached.items.length > 0) {
            return {
                items: cached.items.map(offlineItemToBooking),
                nextOffset: null,
                offline: true,
                syncedAt: cached.updatedAt,
            };
        }

        throw error;
    }
}

export function useCabinetScreenData() {
    const [refreshing, setRefreshing] = useState(false);
    const [activeTab, setActiveTab] = useState<'upcoming' | 'history'>('upcoming');

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

    const userId = userQuery.data?.id ?? null;

    const bookingsQuery = useInfiniteQuery({
        queryKey: ['bookings', userId],
        initialPageParam: 0,
        queryFn: async ({ pageParam }): Promise<BookingsPage> => {
            if (!userId) {
                logDebug('CabinetScreen', 'No user ID, returning empty array');
                return { items: [], nextOffset: null, offline: false, syncedAt: null };
            }
            return loadBookingsPage(userId, pageParam);
        },
        getNextPageParam: (lastPage) => lastPage.nextOffset ?? undefined,
        enabled: !!userId,
    });

    const pages = bookingsQuery.data?.pages;
    const firstPage = pages?.[0];
    const isOfflineData = !!firstPage?.offline;
    const lastSyncAt = firstPage?.syncedAt ?? null;
    const bookings = useMemo(() => {
        if (!pages) return undefined;
        // A booking can move between pages while paging (a new booking shifts offsets): keep one copy.
        const seen = new Set<string>();
        const all: Booking[] = [];
        for (const page of pages) {
            for (const item of page.items) {
                if (seen.has(item.id)) continue;
                seen.add(item.id);
                all.push(item);
            }
        }
        return all;
    }, [pages]);

    // Upcoming and past bookings split by the current time, which moves while the screen is open.
    const { now, refresh: refreshNow } = useNow();

    const onRefresh = async () => {
        setRefreshing(true);
        await bookingsQuery.refetch();
        refreshNow();
        setRefreshing(false);
    };

    const upcomingBookings = useMemo(() => {
        return (bookings ?? []).filter((b) => {
            if (b.status === 'cancelled') return false;
            return new Date(b.end_at) >= now;
        });
    }, [bookings, now]);

    const pastBookings = useMemo(() => {
        return (bookings ?? []).filter((b) => {
            const end = new Date(b.end_at);
            return end < now || b.status === 'cancelled';
        });
    }, [bookings, now]);

    const hasMoreBookings = !!bookingsQuery.hasNextPage && !isOfflineData;
    const isFetchingMore = bookingsQuery.isFetchingNextPage;
    const loadMoreFailed = bookingsQuery.isFetchNextPageError;

    return {
        user: userQuery.data,
        bookings,
        hasBookingsError: bookingsQuery.isError && !bookings,
        isLoading: bookingsQuery.isLoading,
        refreshing,
        activeTab,
        setActiveTab,
        isOfflineData,
        lastSyncAt,
        upcomingBookings,
        pastBookings,
        onRefresh,
        hasMoreBookings,
        isFetchingMore,
        loadMoreFailed,
        loadMore: () => {
            if (!hasMoreBookings || isFetchingMore) return;
            void bookingsQuery.fetchNextPage();
        },
    };
}
