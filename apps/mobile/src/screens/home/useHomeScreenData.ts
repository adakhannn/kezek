import { useEffect, useMemo, useRef, useState } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { apiRequest } from '../../lib/api';
import { fetchCurrentUser } from '../../lib/currentUser';
import { logDebug } from '../../lib/log';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { trackMobileEvent } from '../../lib/analytics';
import type { ClientBookingListItemDto, PublicBusinessDto } from '@shared-client/types';

import type { HomeBooking, HomeBusiness, RecentPlace } from './types';
import { fetchBusinessPromotionCounts, fetchPublicCategories, mergeCategorySlugs } from './homeDiscovery';
import { useNearbyBranches } from './useNearbyBranches';

const NETWORK_ERROR_RE = /network request failed|failed to fetch|network/i;
const SEARCH_DEBOUNCE_MS = 300;
const BUSINESSES_PAGE_SIZE = 20;
const EMPTY_LABELS: Record<string, string> = {};

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
                  tz: booking.business.tz ?? null,
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
                  name_ky: booking.service.name_ky ?? null,
                  name_en: booking.service.name_en ?? null,
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

    // null while browsing signed out (C1): the home screen then shows only the catalog.
    const { data: user } = useQuery({
        queryKey: ['user'],
        queryFn: fetchCurrentUser,
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

    const loadedBusinesses = useMemo(() => {
        const uniqueBusinesses = new Map<string, HomeBusiness>();

        businessPages?.pages.forEach((page) => {
            page.forEach((business) => uniqueBusinesses.set(business.id, business));
        });

        return Array.from(uniqueBusinesses.values());
    }, [businessPages]);

    // The promotions badge of a card, counted as the web home page does (active branches only).
    const businessIds = useMemo(() => loadedBusinesses.map((business) => business.id).sort(), [loadedBusinesses]);
    const { data: promotionCounts } = useQuery({
        queryKey: ['home-promotion-counts', businessIds],
        queryFn: () => fetchBusinessPromotionCounts(businessIds),
        enabled: businessIds.length > 0,
    });

    const businesses = useMemo(
        () =>
            promotionCounts
                ? loadedBusinesses.map((business) => ({ ...business, promotions_count: promotionCounts[business.id] ?? 0 }))
                : loadedBusinesses,
        [loadedBusinesses, promotionCounts],
    );

    // Every public category, not only those of the filtered results (B3): a chip stays after it
    // is picked. Labels come from the categories table, like the web home page.
    const { data: publicCategories } = useQuery({
        queryKey: ['public-categories'],
        queryFn: fetchPublicCategories,
        staleTime: 30 * 60 * 1000,
    });
    const [seenCategorySlugs, setSeenCategorySlugs] = useState<string[]>([]);

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

    useEffect(() => {
        setSeenCategorySlugs((previous) => {
            const next = mergeCategorySlugs(previous, loadedBusinesses.flatMap((business) => business.categories ?? []));
            return next.length === previous.length ? previous : next;
        });
    }, [loadedBusinesses]);

    const categoryLabels = publicCategories?.labels ?? EMPTY_LABELS;

    const availableCategories = useMemo(
        () =>
            mergeCategorySlugs(publicCategories?.slugs ?? [], seenCategorySlugs, selectedCategory ? [selectedCategory] : [])
                .sort((a, b) => (categoryLabels[a] ?? a).localeCompare(categoryLabels[b] ?? b)),
        [categoryLabels, publicCategories?.slugs, seenCategorySlugs, selectedCategory],
    );

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
        categoryLabels,
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
