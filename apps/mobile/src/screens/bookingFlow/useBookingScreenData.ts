import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { InteractionManager } from 'react-native';

import { useBooking } from '../../contexts/BookingContext';
import { supabase } from '../../lib/supabase';
import { trackMobileEvent } from '../../lib/analytics';

type Options = {
    slug?: string;
};

export type BookingInitialData = {
    business: {
        id: string;
        name: string;
        slug: string;
        rating_score: number | null;
    };
    branches: Array<{
        id: string;
        name: string;
        rating_score: number | null;
    }>;
};

export function useBookingScreenData({ slug }: Options) {
    const {
        bookingData,
        hydrateInitialData,
        setPromotions,
        reset,
    } = useBooking();
    const [canLoadPromotions, setCanLoadPromotions] = useState(false);
    const activeBusinessSlug = bookingData.business?.slug;

    useEffect(() => {
        if (!slug) {
            reset();
            return;
        }

        if (activeBusinessSlug && activeBusinessSlug !== slug) {
            reset();
        }
    }, [activeBusinessSlug, reset, slug]);

    useEffect(() => {
        if (bookingData.business?.id) {
            trackMobileEvent({
                eventType: 'booking_flow_start',
                bizId: bookingData.business.id,
            });
        }
    }, [bookingData.business?.id]);

    const businessQuery = useQuery({
        queryKey: ['business-init', slug],
        queryFn: async () => {
            if (!slug) return null;

            const { data: biz, error } = await supabase
                .from('businesses')
                .select('id, name, slug, rating_score')
                .eq('slug', slug)
                .eq('is_approved', true)
                .single();

            if (error) throw error;
            if (!biz) throw new Error('Бизнес не найден');

            const branches = await supabase
                .from('branches')
                .select('id, name, rating_score')
                .eq('biz_id', biz.id)
                .eq('is_active', true)
                .order('rating_score', { ascending: false, nullsFirst: false })
                .order('name');

            if (branches.error) throw branches.error;

            return {
                business: biz,
                branches: branches.data || [],
            } satisfies BookingInitialData;
        },
        enabled: !!slug && activeBusinessSlug !== slug,
    });

    const branchIds = businessQuery.data?.branches.map((branch) => branch.id) ?? [];

    useEffect(() => {
        setCanLoadPromotions(false);

        if (!businessQuery.data?.business.id) {
            return;
        }

        const task = InteractionManager.runAfterInteractions(() => {
            setCanLoadPromotions(true);
        });

        return () => task.cancel();
    }, [businessQuery.data?.business.id]);

    const promotionsQuery = useQuery({
        queryKey: ['booking-promotions', businessQuery.data?.business.id, branchIds],
        queryFn: async () => {
            if (branchIds.length === 0) return [];

            const { data, error } = await supabase
                .from('branch_promotions')
                .select('id, branch_id, promotion_type, title_ru, params')
                .in('branch_id', branchIds)
                .eq('is_active', true)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data || [];
        },
        enabled: canLoadPromotions && branchIds.length > 0,
    });

    useEffect(() => {
        if (businessQuery.isError) {
            reset();
        }
    }, [businessQuery.isError, reset]);

    useEffect(() => {
        if (!businessQuery.data) return;

        hydrateInitialData(businessQuery.data);
    }, [businessQuery.data, hydrateInitialData]);

    useEffect(() => {
        if (promotionsQuery.data) {
            setPromotions(promotionsQuery.data);
        }
    }, [promotionsQuery.data, setPromotions]);

    const cachedInitialData: BookingInitialData | undefined =
        bookingData.business && bookingData.business.slug === slug
            ? {
                  business: bookingData.business,
                  branches: bookingData.branches,
              }
            : undefined;

    return {
        isLoading: businessQuery.isLoading,
        initialData: businessQuery.data ?? cachedInitialData,
    };
}
