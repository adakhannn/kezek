import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';

import type { Service } from '../../contexts/BookingContext';
import { supabase } from '../../lib/supabase';

type BookingDataShape = {
    business?: { id?: string | null } | null;
    branchId?: string | null;
};

type UseBookingStep2ServicesParams = {
    bookingData: BookingDataShape;
    setServices: (services: Service[]) => void;
    setServiceId: (serviceId: string) => void;
};

export function useBookingStep2Services({
    bookingData,
    setServices,
    setServiceId,
}: UseBookingStep2ServicesParams) {
    const { data: servicesData, isLoading } = useQuery<Service[]>({
        queryKey: ['services', bookingData.business?.id, bookingData.branchId],
        queryFn: async () => {
            if (!bookingData.business?.id || !bookingData.branchId) {
                return [];
            }

            const { data, error } = await supabase
                .from('services')
                .select('id, name_ru, duration_min, price_from, price_to, branch_id')
                .eq('biz_id', bookingData.business.id)
                .eq('branch_id', bookingData.branchId)
                .eq('active', true)
                .order('name_ru');

            if (error) {
                throw error;
            }

            return data || [];
        },
        enabled: !!bookingData.business?.id && !!bookingData.branchId,
    });

    useEffect(() => {
        if (!servicesData) {
            return;
        }

        setServices(servicesData);
        if (servicesData.length === 1) {
            setServiceId(servicesData[0].id);
        }
    }, [servicesData, setServices, setServiceId]);

    return {
        servicesData,
        isLoading,
    };
}
