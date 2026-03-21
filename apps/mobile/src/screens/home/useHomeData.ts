import { useQuery } from '@tanstack/react-query';

import { apiRequest } from '../../lib/api';
import { logDebug } from '../../lib/log';
import { supabase } from '../../lib/supabase';
import type { ClientBookingListItemDto, PublicBusinessDto } from '@shared-client/types';

import type { Business, HomeBooking } from './types';

type Options = {
    search: string;
    selectedCategory: string | null;
    onNetworkError: (value: boolean) => void;
};

export function useHomeData({
    search,
    selectedCategory,
    onNetworkError,
}: Options) {
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

    const businessesQuery = useQuery<Business[]>({
        queryKey: ['businesses', search, selectedCategory],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (search.trim()) {
                params.set('search', search.trim());
            }
            if (selectedCategory) {
                params.set('category', selectedCategory);
            }

            const endpoint = `/mobile/businesses${params.toString() ? `?${params.toString()}` : ''}`;
            const data = await apiRequest<PublicBusinessDto[]>(endpoint);
            logDebug('HomeScreen', 'Businesses loaded', { count: data?.length || 0 });

            return (data ?? []).map(
                (business): Business => ({
                    id: business.id,
                    name: business.name,
                    slug: business.slug,
                    address: business.address,
                    phones: business.phones,
                    categories: business.categories,
                    rating_score: business.rating_score,
                }),
            );
        },
    });

    const bookingsQuery = useQuery({
        queryKey: ['home-bookings', userQuery.data?.id],
        enabled: !!userQuery.data?.id,
        queryFn: async () => {
            if (!userQuery.data?.id) return [] as HomeBooking[];

            const data = await apiRequest<ClientBookingListItemDto[]>('/mobile/bookings');
            logDebug('HomeScreen', 'Home bookings loaded', { count: data?.length || 0 });

            return (data ?? []).map(
                (booking): HomeBooking => ({
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
                }),
            );
        },
    });

    return {
        user: userQuery.data,
        userQuery,
        businessesQuery,
        bookingsQuery,
    };
}
