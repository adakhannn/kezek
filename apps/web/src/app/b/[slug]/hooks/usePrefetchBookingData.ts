import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { supabase } from '@/lib/supabaseClient';

/**
 * Хук для prefetching данных, которые вероятно понадобятся пользователю
 * Вызывается при наведении на кнопку "Записаться" или при загрузке страницы бизнеса
 */
export function usePrefetchBookingData(bizId: string, branchIds: string[], staffIds: string[]) {
    const queryClient = useQueryClient();

    useEffect(() => {
        // Prefetch промоакций для всех филиалов
        if (branchIds.length > 0) {
            branchIds.forEach((branchId) => {
                queryClient.prefetchQuery({
                    queryKey: ['branch-promotions', branchId],
                    queryFn: async () => {
                        const { data, error } = await supabase
                            .from('branch_promotions')
                            .select('id, promotion_type, title_ru, params')
                            .eq('branch_id', branchId)
                            .eq('is_active', true)
                            .order('created_at', { ascending: false });

                        if (error) throw error;
                        return (data || []) as Array<{
                            id: string;
                            promotion_type: string;
                            title_ru: string | null;
                            params: Record<string, unknown>;
                        }>;
                    },
                    staleTime: 2 * 60 * 1000, // 2 минуты
                });
            });
        }

        // Prefetch связей услуга-мастер
        if (staffIds.length > 0) {
            queryClient.prefetchQuery({
                queryKey: ['service-staff', bizId, staffIds.sort().join(',')],
                queryFn: async () => {
                    const { data, error } = await supabase
                        .from('service_staff')
                        .select('service_id, staff_id, is_active')
                        .eq('is_active', true)
                        .in('staff_id', staffIds);

                    if (error) throw error;
                    return (data || []) as Array<{ service_id: string; staff_id: string; is_active: boolean }>;
                },
                staleTime: 5 * 60 * 1000,
            });
        }
    }, [queryClient, bizId, branchIds, staffIds]);
}

