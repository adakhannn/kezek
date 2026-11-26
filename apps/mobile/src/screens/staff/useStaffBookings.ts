import { useInfiniteQuery } from '@tanstack/react-query';

import { supabase } from '../../lib/supabase';
import type { BookingRow, StaffBookingsTab, UpcomingBooking } from './types';

/** Bookings per page of the staff list (S1). */
export const STAFF_BOOKINGS_PAGE_SIZE = 20;

type Page = { items: UpcomingBooking[]; nextOffset: number | null };

function toBooking(booking: BookingRow): UpcomingBooking {
    return {
        id: booking.id,
        status: booking.status ?? null,
        start_at: booking.start_at,
        end_at: booking.end_at,
        client_name: booking.client_name,
        client_phone: booking.client_phone,
        service: Array.isArray(booking.service) ? (booking.service[0] ?? null) : booking.service,
    };
}

/**
 * The master's own bookings, like the website's /staff/bookings (S1): "upcoming" are those not yet
 * ended (cancelled excluded), soonest first; "past" have ended, latest first, any status. Read with
 * the master's session (RLS gives a staff card its bookings), a page at a time; one extra row tells
 * whether another page exists.
 */
export async function fetchStaffBookingsPage(staffId: string, tab: StaffBookingsTab, offset: number, now: Date = new Date()): Promise<Page> {
    let query = supabase
        .from('bookings')
        .select(`
            id,
            status,
            start_at,
            end_at,
            client_name,
            client_phone,
            service:services(name_ru, name_ky, name_en)
        `)
        .eq('staff_id', staffId);
    query = tab === 'upcoming'
        ? query.neq('status', 'cancelled').gte('end_at', now.toISOString()).order('start_at', { ascending: true })
        : query.lt('end_at', now.toISOString()).order('start_at', { ascending: false });
    const { data, error } = await query
        .order('id', { ascending: true })
        .range(offset, offset + STAFF_BOOKINGS_PAGE_SIZE);
    if (error) throw error;
    const rows = (data as BookingRow[] | null) ?? [];
    return {
        items: rows.slice(0, STAFF_BOOKINGS_PAGE_SIZE).map(toBooking),
        nextOffset: rows.length > STAFF_BOOKINGS_PAGE_SIZE ? offset + STAFF_BOOKINGS_PAGE_SIZE : null,
    };
}

export function useStaffBookings(staffId: string | undefined, tab: StaffBookingsTab) {
    const query = useInfiniteQuery({
        // ['staff-bookings'] is refreshed when the staff card changes (useCurrentStaff).
        queryKey: ['staff-bookings', staffId, tab],
        queryFn: ({ pageParam }) => fetchStaffBookingsPage(staffId as string, tab, pageParam),
        initialPageParam: 0,
        getNextPageParam: (last: Page) => last.nextOffset ?? undefined,
        enabled: !!staffId,
    });
    // A booking can move between pages while paging (a new booking shifts the offsets): show it once.
    const seen = new Set<string>();
    const bookings = (query.data?.pages ?? []).flatMap((page) => page.items).filter((booking) => {
        if (seen.has(booking.id)) return false;
        seen.add(booking.id);
        return true;
    });
    return {
        bookings,
        isLoading: query.isLoading,
        error: query.error as Error | null,
        hasMore: !!query.hasNextPage,
        isLoadingMore: query.isFetchingNextPage,
        loadMore: () => { if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage(); },
        refetch: async () => { await query.refetch(); },
    };
}
