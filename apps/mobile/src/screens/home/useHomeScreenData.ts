import { useEffect, useMemo, useRef, useState } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { apiRequest } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import { logDebug } from '../../lib/log';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { trackMobileEvent } from '../../lib/analytics';
import type { ClientBookingListItemDto, PublicBusinessDto } from '@shared-client/types';

import type { HomeBooking, HomeBusiness, RecentPlace } from './types';
import { useNearbyBranches } from './useNearbyBranches';

const NETWORK_ERROR_RE = /network request failed|failed to fetch|network/i;
const SEARCH_DEBOUNCE_MS = 300;
const BUSINESSES_PAGE_SIZE = 20;

type ApiEnvelope<T> = {
    ok?: boolean;
    data?: T;
};

function unwrapList<T>(payload: T[] | ApiEnvelope<T[]> | null | undefined): T[] {
    if (Array.isArray(payload)) {
        return payload;
    }

    if (payload && typeof payload === 'object' && Array.isArray(payload.data)) {
        return payload.data;
    }

    return [];
}

function mapBusinessDto(business: PublicBusinessDto): HomeBusiness {
    return {
        id: business.id,
        name: business.name,
        slug: business.slug,
        address: business.address,
        phones: business.phones,
        categories: business.categories,
        rating_score: business.rating_score,
    };
}

function mapBookingDto(booking: ClientBookingListItemDto): HomeBooking {
    return {
        id: booking.id,
        start_at: booking.start_at,
        end_at: booking.end_at,
        status: booking.status,
        business: booking.business
            ? {
                  name: booking.business.name ?? '',
                  slug: booking.business.slug ?? null,
              }
            : null,
        branch: booking.branch
            ? {
                  name: booking.branch.name ?? null,
              }
            : null,
        service: booking.service
            ? {
                  name_ru: booking.service.name_ru ?? '',
              }
            : null,
    };
}

export function useHomeScreenData() {
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);
    const [hasNetworkError, setHasNetworkError] = useState(false);
    const { isOffline } = useNetworkStatus();
    const wasOfflineRef = useRef(isOffline);
    const nearby = useNearbyBranches();

    useEffect(() => {
        trackMobileEvent({ eventType: 'home_view' });
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(search);
        }, SEARCH_DEBOUNCE_MS);

        return () => clearTimeout(timer);
    }, [search]);

    const { data: user } = useQuery({
        queryKey: ['user'],
        queryFn: async () => {
            const {
                data: { user },
                error,
            } = await supabase.auth.getUser();

            if (error) {
                throw error;
            }

            return user;
        },
    });

    const {
        data: businessPages,
        isLoading: isBusinessesLoading,
        refetch: refetchBusinesses,
        error: businessesError,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
    } = useInfiniteQuery<HomeBusiness[]>({
        queryKey: ['businesses', debouncedSearch, selectedCategory],
        initialPageParam: 1,
        queryFn: async ({ pageParam }) => {
            const params = new URLSearchParams();
            const page = typeof pageParam === 'number' ? pageParam : 1;

            if (debouncedSearch.trim()) {
                params.set('search', debouncedSearch.trim());
            }

            if (selectedCategory) {
                params.set('category', selectedCategory);
            }

            params.set('page', String(page));
            params.set('limit', String(BUSINESSES_PAGE_SIZE));

            const endpoint = `/mobile/businesses?${params.toString()}`;
            const payload = await apiRequest<PublicBusinessDto[] | ApiEnvelope<PublicBusinessDto[]>>(
                endpoint,
            );
            const data = unwrapList(payload);

            logDebug('HomeScreen', 'Businesses loaded', { count: data.length });

            return data.map(mapBusinessDto);
        },
        getNextPageParam: (lastPage, allPages) => {
            if (lastPage.length < BUSINESSES_PAGE_SIZE) {
                return undefined;
            }

            const previousPage = allPages.at(-2);
            const isRepeatedLegacyPage =
                previousPage?.length === lastPage.length &&
                previousPage[0]?.id === lastPage[0]?.id &&
                previousPage.at(-1)?.id === lastPage.at(-1)?.id;

            return isRepeatedLegacyPage ? undefined : allPages.length + 1;
        },
    });

    const businesses = useMemo(() => {
        const uniqueBusinesses = new Map<string, HomeBusiness>();

        businessPages?.pages.forEach((page) => {
            page.forEach((business) => uniqueBusinesses.set(business.id, business));
        });

        return Array.from(uniqueBusinesses.values());
    }, [businessPages]);

    const { data: bookings = [] } = useQuery<HomeBooking[]>({
        queryKey: ['home-bookings', user?.id],
        enabled: !!user?.id,
        queryFn: async () => {
            if (!user?.id) {
                return [];
            }

            const payload = await apiRequest<
                ClientBookingListItemDto[] | ApiEnvelope<ClientBookingListItemDto[]>
            >('/mobile/bookings');
            const data = unwrapList(payload);
            logDebug('HomeScreen', 'Home bookings loaded', { count: data.length });

            return data.map(mapBookingDto);
        },
    });

    useEffect(() => {
        if (!businessesError) {
            setHasNetworkError(false);
            return;
        }

        const message =
            businessesError instanceof Error ? businessesError.message : String(businessesError);

        if (NETWORK_ERROR_RE.test(message)) {
            setHasNetworkError(true);
        }
    }, [businessesError]);

    useEffect(() => {
        const wasOffline = wasOfflineRef.current;
        wasOfflineRef.current = isOffline;

        if (wasOffline && !isOffline && hasNetworkError) {
            void refetchBusinesses();
        }
    }, [hasNetworkError, isOffline, refetchBusinesses]);

    const upcomingBookings = useMemo(() => {
        if (bookings.length === 0) {
            return [] as HomeBooking[];
        }

        const nowTime = Date.now();

        return bookings
            .filter((booking) => {
                if (booking.status === 'cancelled' || booking.status === 'no_show') {
                    return false;
                }

                const start = new Date(booking.start_at).getTime();
                return Number.isFinite(start) && start >= nowTime;
            })
            .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())
            .slice(0, 3);
    }, [bookings]);

    const recentPlaces = useMemo(() => {
        if (bookings.length === 0) {
            return [] as RecentPlace[];
        }

        const seen = new Set<string>();
        const places: RecentPlace[] = [];

        [...bookings]
            .sort((a, b) => new Date(b.start_at).getTime() - new Date(a.start_at).getTime())
            .forEach((booking) => {
                const slug = booking.business?.slug;
                const name = booking.business?.name;

                if (!slug || !name || seen.has(slug)) {
                    return;
                }

                seen.add(slug);
                places.push({ slug, name });
            });

        return places.slice(0, 3);
    }, [bookings]);

    const availableCategories = useMemo(() => {
        const categories = new Set<string>();

        businesses.forEach((business) => {
            business.categories?.forEach((category) => categories.add(category));
        });

        return Array.from(categories).sort();
    }, [businesses]);

    const onRefresh = async () => {
        setRefreshing(true);
        await Promise.all([refetchBusinesses()]);
        setRefreshing(false);
    };

    const clearSearch = () => {
        setSearch('');
        setSelectedCategory(null);
    };

    return {
        user,
        search,
        setSearch,
        selectedCategory,
        setSelectedCategory,
        refreshing,
        businesses,
        upcomingBookings,
        recentPlaces,
        availableCategories,
        isBusinessesLoading,
        businessesError,
        showOfflineBanner: isOffline || hasNetworkError,
        onRefresh,
        retryBusinesses: refetchBusinesses,
        loadMoreBusinesses: () => {
            if (hasNextPage && !isFetchingNextPage) {
                void fetchNextPage();
            }
        },
        hasMoreBusinesses: Boolean(hasNextPage),
        isLoadingMoreBusinesses: isFetchingNextPage,
        clearSearch,
        ...nearby,
    };
}
