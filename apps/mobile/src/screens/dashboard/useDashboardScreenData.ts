import { useState } from 'react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '../../hooks/useAuth';
import { apiRequest } from '../../lib/api';
import { fetchManagerBookingsPage, runManagerBookingAction, type ManagerBookingsPage } from './managerBookings';
import type { Business, ManagerBookingAction, ManagerBookingsScope } from './types';

/**
 * The Business tab (O1, O3): the businesses the user owns or manages (owner, admin or manager, the
 * website's rule) and the bookings feed of the chosen one, today or after today, with the actions
 * the website's dashboard has. Configuration and finance stay on the website.
 */
export function useDashboardScreenData() {
    const [refreshing, setRefreshing] = useState(false);
    const [chosenBizId, setChosenBizId] = useState<string | null>(null);
    const [scope, setScope] = useState<ManagerBookingsScope>('today');
    const { user } = useAuth();
    const queryClient = useQueryClient();

    const businessesQuery = useQuery({
        queryKey: ['my-businesses', user?.id],
        queryFn: async () => {
            const response = await apiRequest<{ ok?: boolean; data?: Business[] }>('/api/mobile/manager/businesses');
            if (!response?.ok || !Array.isArray(response.data)) throw new Error('Unexpected businesses response');
            return response.data;
        },
        enabled: !!user?.id,
    });
    const businesses = businessesQuery.data ?? [];
    const business = businesses.find((item) => item.id === chosenBizId) ?? businesses[0] ?? null;
    const bizId = business?.id ?? null;

    const bookingsKey = ['manager-bookings', user?.id, bizId, scope];
    const bookingsQuery = useInfiniteQuery({
        queryKey: bookingsKey,
        queryFn: ({ pageParam }) => fetchManagerBookingsPage(bizId as string, scope, pageParam),
        initialPageParam: 0,
        getNextPageParam: (last: ManagerBookingsPage) => last.nextOffset ?? undefined,
        enabled: !!bizId,
    });
    const seen = new Set<string>();
    const bookings = (bookingsQuery.data?.pages ?? []).flatMap((page) => page.items).filter((booking) => {
        if (seen.has(booking.id)) return false;
        seen.add(booking.id);
        return true;
    });

    const actionMutation = useMutation({
        mutationFn: ({ bookingId, action }: { bookingId: string; action: ManagerBookingAction }) => runManagerBookingAction(bookingId, action),
        // Whatever the outcome, the list is read again: the booking may have changed elsewhere.
        onSettled: () => queryClient.invalidateQueries({ queryKey: ['manager-bookings'] }),
    });

    const onRefresh = async () => {
        setRefreshing(true);
        try {
            await Promise.all([businessesQuery.refetch(), bizId ? bookingsQuery.refetch() : Promise.resolve()]);
        } finally {
            setRefreshing(false);
        }
    };

    return {
        businesses,
        business,
        selectBusiness: setChosenBizId,
        isOwner: businesses.length > 0,
        isLoading: businessesQuery.isLoading && !refreshing,
        loadError: businessesQuery.error,
        scope,
        setScope,
        bookings,
        timezone: bookingsQuery.data?.pages[0]?.timezone ?? business?.tz ?? null,
        bookingsLoading: bookingsQuery.isLoading,
        bookingsError: bookingsQuery.error as Error | null,
        hasMore: !!bookingsQuery.hasNextPage,
        isLoadingMore: bookingsQuery.isFetchingNextPage,
        loadMore: () => { if (bookingsQuery.hasNextPage && !bookingsQuery.isFetchingNextPage) void bookingsQuery.fetchNextPage(); },
        retryBookings: () => void bookingsQuery.refetch(),
        runAction: (bookingId: string, action: ManagerBookingAction) => actionMutation.mutateAsync({ bookingId, action }),
        pendingBookingId: actionMutation.isPending ? actionMutation.variables?.bookingId ?? null : null,
        refreshing,
        onRefresh,
    };
}
