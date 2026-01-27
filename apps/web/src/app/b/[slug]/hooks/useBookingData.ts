import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabaseClient';

type Branch = {
    id: string;
    name: string;
    address?: string | null;
    rating_score: number | null;
};

type Service = {
    id: string;
    name_ru: string;
    name_ky?: string | null;
    name_en?: string | null;
    duration_min: number;
    price_from?: number | null;
    price_to?: number | null;
    branch_id: string;
};

type Staff = {
    id: string;
    full_name: string;
    branch_id: string;
    avatar_url?: string | null;
    rating_score: number | null;
};

type Promotion = {
    id: string;
    branch_id: string;
    promotion_type: string;
    title_ru: string | null;
    params: Record<string, unknown>;
    branches?: { name: string };
};

type BookingData = {
    branches: Branch[];
    services: Service[];
    staff: Staff[];
    promotions: Promotion[];
};

/**
 * Хук для загрузки данных бизнеса с кэшированием
 * Использует React Query для автоматического кэширования и управления состоянием
 */
export function useBookingData(bizId: string) {
    return useQuery<BookingData>({
        queryKey: ['booking-data', bizId],
        queryFn: async () => {
            // Загружаем филиалы
            const { data: branches, error: branchesError } = await supabase
                .from('branches')
                .select('id, name, address, rating_score')
                .eq('biz_id', bizId)
                .eq('is_active', true)
                .order('rating_score', { ascending: false, nullsFirst: false })
                .order('name');

            if (branchesError) throw branchesError;
            if (!branches || branches.length === 0) {
                return { branches: [], services: [], staff: [], promotions: [] };
            }

            const branchIds = branches.map((b) => b.id);

            // Загружаем услуги, мастеров и промо параллельно
            const [servicesResult, staffResult, promotionsResult] = await Promise.all([
                supabase
                    .from('services')
                    .select('id, name_ru, name_ky, name_en, duration_min, price_from, price_to, branch_id')
                    .eq('biz_id', bizId)
                    .eq('active', true)
                    .order('name_ru'),
                supabase
                    .from('staff')
                    .select('id, full_name, branch_id, avatar_url, rating_score')
                    .eq('biz_id', bizId)
                    .eq('is_active', true)
                    .order('rating_score', { ascending: false, nullsFirst: false })
                    .order('full_name'),
                branchIds.length > 0
                    ? supabase
                          .from('branch_promotions')
                          .select('id, branch_id, promotion_type, title_ru, params, branches(name)')
                          .in('branch_id', branchIds)
                          .eq('is_active', true)
                          .order('created_at', { ascending: false })
                    : Promise.resolve({ data: [], error: null }),
            ]);

            if (servicesResult.error) throw servicesResult.error;
            if (staffResult.error) throw staffResult.error;
            if (promotionsResult.error) throw promotionsResult.error;

            return {
                branches: branches || [],
                services: servicesResult.data || [],
                staff: staffResult.data || [],
                promotions: (promotionsResult.data || []) as Promotion[],
            };
        },
        staleTime: 5 * 60 * 1000, // 5 минут
        gcTime: 10 * 60 * 1000, // 10 минут
    });
}

/**
 * Хук для загрузки промоакций филиала с кэшированием
 */
export function useBranchPromotions(branchId: string | null) {
    return useQuery<Promotion[]>({
        queryKey: ['branch-promotions', branchId],
        queryFn: async () => {
            if (!branchId) return [];

            const { data, error } = await supabase
                .from('branch_promotions')
                .select('id, promotion_type, title_ru, params')
                .eq('branch_id', branchId)
                .eq('is_active', true)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return (data || []) as Promotion[];
        },
        enabled: !!branchId,
        staleTime: 2 * 60 * 1000, // 2 минуты (промо меняются реже)
        gcTime: 5 * 60 * 1000,
    });
}

/**
 * Хук для загрузки связей услуга-мастер с кэшированием
 */
export function useServiceStaff(bizId: string, staffIds: string[]) {
    return useQuery<Array<{ service_id: string; staff_id: string; is_active: boolean }>>({
        queryKey: ['service-staff', bizId, staffIds.sort().join(',')],
        queryFn: async () => {
            if (staffIds.length === 0) return [];

            const { data, error } = await supabase
                .from('service_staff')
                .select('service_id, staff_id, is_active')
                .eq('is_active', true)
                .in('staff_id', staffIds);

            if (error) throw error;
            return (data || []) as Array<{ service_id: string; staff_id: string; is_active: boolean }>;
        },
        enabled: staffIds.length > 0,
        staleTime: 5 * 60 * 1000,
        gcTime: 10 * 60 * 1000,
    });
}

/**
 * Хук для загрузки бронирований клиента на выбранный день
 */
export function useClientBookings(bizId: string, dayStr: string | null, enabled: boolean) {
    return useQuery<number>({
        queryKey: ['client-bookings', bizId, dayStr],
        queryFn: async () => {
            if (!dayStr) return 0;

            const { data: auth } = await supabase.auth.getUser();
            const userId = auth.user?.id;
            if (!userId) return 0;

            // Ищем все брони клиента в этом бизнесе на выбранный день
            const dayStartUTC = new Date(dayStr + 'T00:00:00Z');
            const dayEndUTC = new Date(dayStr + 'T23:59:59.999Z');
            const searchStart = new Date(dayStartUTC.getTime() - 12 * 60 * 60 * 1000);
            const searchEnd = new Date(dayEndUTC.getTime() + 12 * 60 * 60 * 1000);

            const { data, error } = await supabase
                .from('bookings')
                .select('id', { count: 'exact' })
                .eq('biz_id', bizId)
                .eq('client_id', userId)
                .in('status', ['hold', 'confirmed', 'paid'])
                .gte('start_at', searchStart.toISOString())
                .lte('start_at', searchEnd.toISOString());

            if (error) throw error;
            return (data?.length || 0);
        },
        enabled: enabled && !!dayStr,
        staleTime: 1 * 60 * 1000, // 1 минута (брони могут быстро меняться)
        gcTime: 2 * 60 * 1000,
    });
}

