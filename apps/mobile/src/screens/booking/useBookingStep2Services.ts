import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import type { Service } from '../../contexts/BookingContext';
import { supabase } from '../../lib/supabase';
import { servicesWithStaff, staffForBranch } from './bookingSelection';
import { useStaffCatalogue } from './useBookingStep3Staff';
import { useBookingWorkLocations } from './useBookingWorkLocations';

type BookingDataShape = {
    business?: { id?: string | null; tz?: string | null } | null;
    branchId?: string | null;
    serviceIds?: string[];
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
    const { data: allServices, isLoading, error, isFetching, refetch } = useQuery<Service[]>({
        queryKey: ['services', bookingData.business?.id, bookingData.branchId],
        queryFn: async () => {
            if (!bookingData.business?.id || !bookingData.branchId) {
                return [];
            }

            const { data, error: servicesError } = await supabase
                .from('services')
                .select('id, name_ru, name_ky, name_en, duration_min, price_from, price_to, branch_id')
                .eq('biz_id', bookingData.business.id)
                .eq('branch_id', bookingData.branchId)
                .eq('active', true)
                .order('name_ru');

            if (servicesError) {
                throw servicesError;
            }

            return data || [];
        },
        enabled: !!bookingData.business?.id && !!bookingData.branchId,
    });

    // Only services a master of this branch performs, as the web booking lists them. If masters
    // fail to load, every service stays: the master step shows that error with a retry.
    const bizId = bookingData.business?.id;
    const branchId = bookingData.branchId;
    const catalogue = useStaffCatalogue(bizId, !!branchId);
    const locations = useBookingWorkLocations(branchId ? bizId : null, bookingData.business?.tz);
    const staffFailed = !!catalogue.error || !!locations.error;
    const servicesData = useMemo(() => {
        if (!allServices || !branchId) return undefined;
        if (catalogue.data && locations.data) {
            return servicesWithStaff(allServices, catalogue.data.links, staffForBranch(catalogue.data.staff, branchId, locations.data));
        }
        return staffFailed ? allServices : undefined;
    }, [allServices, branchId, catalogue.data, locations.data, staffFailed]);

    const hasSelection = (bookingData.serviceIds?.length ?? 0) > 0;
    useEffect(() => {
        if (!servicesData) {
            return;
        }

        setServices(servicesData);
        if (servicesData.length === 1 && !hasSelection) {
            setServiceId(servicesData[0].id);
        }
    }, [servicesData, setServices, setServiceId, hasSelection]);

    const hasError = !allServices && !!error;
    return {
        servicesData,
        isLoading: (isLoading || (!!allServices && !servicesData)) && !hasError,
        /** Loading failed (B4): not the same as a branch without services. */
        hasError,
        isRetrying: hasError && isFetching,
        retry: () => {
            void refetch();
        },
    };
}
