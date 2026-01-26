import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { supabase } from '../lib/supabase';
import { useBooking } from '../contexts/BookingContext';
import BookingStep1Branch from './booking/BookingStep1Branch';

type BookingRouteParams = {
    slug: string;
};

type BookingScreenRouteProp = RouteProp<{ params: BookingRouteParams }, 'params'>;

export default function BookingScreen() {
    const route = useRoute<BookingScreenRouteProp>();
    const { slug } = route.params || {};
    const { bookingData, setBusiness, setBranches, setServices, setStaff, setPromotions, setBranchId } = useBooking();

    // Загружаем данные бизнеса при первом открытии
    const { data: businessData, isLoading } = useQuery({
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

            const [branches, services, staff] = await Promise.all([
                supabase
                    .from('branches')
                    .select('id, name, rating_score')
                    .eq('biz_id', biz.id)
                    .eq('is_active', true)
                    .order('rating_score', { ascending: false, nullsFirst: false })
                    .order('name'),
                supabase
                    .from('services')
                    .select('id, name_ru, duration_min, price_from, price_to, branch_id')
                    .eq('biz_id', biz.id)
                    .eq('active', true)
                    .order('name_ru'),
                supabase
                    .from('staff')
                    .select('id, full_name, branch_id, rating_score, avatar_url')
                    .eq('biz_id', biz.id)
                    .eq('is_active', true)
                    .order('rating_score', { ascending: false, nullsFirst: false })
                    .order('full_name'),
            ]);

            // Получаем ID филиалов для загрузки промоакций
            const branchIds = (branches.data || []).map((b) => b.id);
            
            // Загружаем промоакции для всех филиалов бизнеса
            let promotions: Array<{ id: string; branch_id: string; promotion_type: string; title_ru: string | null; params: Record<string, unknown> }> = [];
            if (branchIds.length > 0) {
                const { data: promotionsData, error: promotionsError } = await supabase
                    .from('branch_promotions')
                    .select('id, branch_id, promotion_type, title_ru, params')
                    .in('branch_id', branchIds)
                    .eq('is_active', true)
                    .order('created_at', { ascending: false });
                
                if (!promotionsError && promotionsData) {
                    promotions = promotionsData;
                }
            }

            return {
                business: biz,
                branches: branches.data || [],
                services: services.data || [],
                staff: staff.data || [],
                promotions: promotions,
            };
        },
        enabled: !!slug && !bookingData.business,
    });

    useEffect(() => {
        if (businessData) {
            setBusiness(businessData.business);
            setBranches(businessData.branches);
            setServices(businessData.services);
            setStaff(businessData.staff);
            setPromotions(businessData.promotions);
            if (businessData.branches.length === 1) {
                setBranchId(businessData.branches[0].id);
            }
        }
    }, [businessData, setBusiness, setBranches, setServices, setStaff, setPromotions, setBranchId]);

    // Просто рендерим первый шаг
    return <BookingStep1Branch />;
}
