import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';

import { supabase } from '../../lib/supabase';
import {
    ANY_STAFF,
    filterStaffForServices,
    staffForBranch,
    type ServiceStaffLink,
} from './bookingSelection';
import { useBookingWorkLocations } from './useBookingWorkLocations';

type BookingDataShape = {
    business?: { id?: string | null; tz?: string | null } | null;
    branchId?: string | null;
    serviceId?: string | null;
    serviceIds?: string[];
    staffId?: string | null;
};

export type StaffItem = {
    id: string;
    full_name: string;
    branch_id: string;
    rating_score: number | null;
    avatar_url: string | null;
};

type UseBookingStep3StaffParams = {
    bookingData: BookingDataShape;
    setStaff: (staff: StaffItem[]) => void;
    setStaffId: (staffId: string) => void;
};

/** One chosen service: see filterStaffForServices. */
export function filterStaffForService<T extends { id: string }>(
    staff: T[],
    links: ServiceStaffLink[],
    serviceId: string | null | undefined,
): T[] {
    return filterStaffForServices(staff, links, serviceId ? [serviceId] : []);
}

export type StaffCatalogue = { staff: StaffItem[]; links: ServiceStaffLink[] };

/** Every active master of the business and the service links, shared by the service and master steps. */
export function useStaffCatalogue(bizId: string | null | undefined, enabled = true) {
    return useQuery<StaffCatalogue>({
        queryKey: ['staff', bizId],
        queryFn: async () => {
            // Every active master of the business: one working at this branch today may have
            // another home branch (C5, web useTemporaryTransfers).
            const [staffResult, linksResult] = await Promise.all([
                supabase
                    .from('staff')
                    .select('id, full_name, branch_id, rating_score, avatar_url')
                    .eq('biz_id', bizId!)
                    .eq('is_active', true)
                    .order('rating_score', { ascending: false, nullsFirst: false })
                    .order('full_name'),
                supabase
                    .from('service_staff')
                    .select('service_id, staff_id, services!inner(biz_id)')
                    .eq('services.biz_id', bizId!)
                    .eq('is_active', true),
            ]);

            if (staffResult.error) {
                throw staffResult.error;
            }
            if (linksResult.error) {
                throw linksResult.error;
            }

            return {
                staff: (staffResult.data || []) as StaffItem[],
                links: (linksResult.data || []) as ServiceStaffLink[],
            };
        },
        enabled: !!bizId && enabled,
    });
}

export function useBookingStep3Staff({
    bookingData,
    setStaff,
    setStaffId,
}: UseBookingStep3StaffParams) {
    const bizId = bookingData.business?.id;
    const branchId = bookingData.branchId;
    const serviceIds = bookingData.serviceIds ?? (bookingData.serviceId ? [bookingData.serviceId] : []);
    const serviceIdsKey = [...serviceIds].sort().join(',');

    const catalogueQuery = useStaffCatalogue(bizId, !!branchId);
    const locationsQuery = useBookingWorkLocations(branchId ? bizId : null, bookingData.business?.tz);

    const catalogue = catalogueQuery.data;
    const locations = locationsQuery.data;
    const staffData =
        catalogue && locations && branchId
            ? filterStaffForServices(staffForBranch(catalogue.staff, branchId, locations), catalogue.links, serviceIds)
            : undefined;
    const staffKey = staffData?.map((person) => person.id).join(',') ?? null;

    useEffect(() => {
        if (!staffData) {
            return;
        }

        setStaff(staffData);
        const current = bookingData.staffId;
        const stillOffered = !current || current === ANY_STAFF || staffData.some((person) => person.id === current);
        if (!stillOffered || (!current && staffData.length === 1)) {
            // A master who does not perform every chosen service is not kept (C3).
            setStaffId(staffData.length === 1 ? staffData[0].id : '');
        }
        // staffKey and serviceIdsKey stand for staffData, which is a new array every render.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [setStaff, setStaffId, staffKey, serviceIdsKey]);

    const failed = !staffData && (!!catalogueQuery.error || !!locationsQuery.error);
    return {
        staffData,
        isLoading: !failed && !!bizId && !!branchId && !staffData,
        /** Loading failed (B4): not the same as a branch without masters. */
        hasError: failed,
        isRetrying: failed && (catalogueQuery.isFetching || locationsQuery.isFetching),
        retry: () => {
            if (catalogueQuery.error) void catalogueQuery.refetch();
            if (locationsQuery.error) void locationsQuery.refetch();
        },
    };
}
