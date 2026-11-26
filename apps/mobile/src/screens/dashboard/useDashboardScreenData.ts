import { useState } from 'react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '../../hooks/useAuth';
import { apiRequest } from '../../lib/api';
import { ensureCurrentBusiness, resetCurrentBusiness } from '../manage/currentBusiness';
import { fetchManagerBookingsPage, runManagerBookingAction, type ManagerBookingsPage } from './managerBookings';
import type { Business, ManagerBookingAction, ManagerBookingsScope } from './types';

/** The business the website's cabinet currently works with (user_current_business), or null. */
export async function fetchServerCurrentBusinessId(): Promise<string | null> {
    const response = await apiRequest<{ ok?: boolean; data?: { currentBizId?: string | null } }>('/me/current-business');
    return response?.ok ? response.data?.currentBizId ?? null : null;
}

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
    // The website's current business (/select-business) is the default choice here too, so the
    // app opens on the business the web cabinet works with.
    const currentQuery = useQuery({
        queryKey: ['current-business', user?.id],
        queryFn: fetchServerCurrentBusinessId,
        enabled: !!user?.id && businesses.length > 1,
    });
    const business = businesses.find((item) => item.id === chosenBizId)
        ?? businesses.find((item) => item.id === currentQuery.data)
        ?? businesses[0]
        ?? null;
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
        /**
         * Choosing a business is also the website's /select-business choice: the server's current
         * business follows, so the web cabinet and the management sections act on the same one.
         * Rejects when the server refused; the app keeps showing the chosen business.
         */
        selectBusiness: async (bizId: string) => {
            setChosenBizId(bizId);
            resetCurrentBusiness();
            await ensureCurrentBusiness(bizId);
            queryClient.setQueryData(['current-business', user?.id], bizId);
        },
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
