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
    const { bookingData, setBusiness, setBranches, setServices, setStaff, setBranchId } = useBooking();

    // Загружаем данные бизнеса при первом открытии
    const { isLoading } = useQuery({
        queryKey: ['business-init', slug],
        queryFn: async () => {
            if (!slug) return null;

            const { data: biz, error } = await supabase
                .from('businesses')
                .select('id, name, slug')
                .eq('slug', slug)
                .eq('is_approved', true)
                .single();

            if (error) throw error;
            if (!biz) throw new Error('Бизнес не найден');

            const [branches, services, staff] = await Promise.all([
                supabase
                    .from('branches')
                    .select('id, name')
                    .eq('biz_id', biz.id)
                    .eq('is_active', true)
                    .order('name'),
                supabase
                    .from('services')
                    .select('id, name_ru, duration_min, price_from, price_to, branch_id')
                    .eq('biz_id', biz.id)
                    .eq('active', true)
                    .order('name_ru'),
                supabase
                    .from('staff')
                    .select('id, full_name, branch_id')
                    .eq('biz_id', biz.id)
                    .eq('is_active', true)
                    .order('full_name'),
            ]);

            return {
                business: biz,
                branches: branches.data || [],
                services: services.data || [],
                staff: staff.data || [],
            };
        },
        enabled: !!slug && !bookingData.business,
    });

    useEffect(() => {
        // Данные загружаются в BookingStep1Branch, здесь просто проверяем
    }, []);

    // Просто рендерим первый шаг
    return <BookingStep1Branch />;
}
