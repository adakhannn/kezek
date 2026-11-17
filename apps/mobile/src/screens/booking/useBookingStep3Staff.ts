import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';

import { supabase } from '../../lib/supabase';

type BookingDataShape = {
    business?: { id?: string | null } | null;
    branchId?: string | null;
    serviceId?: string | null;
};

type StaffItem = {
    id: string;
    full_name: string;
    branch_id: string;
    rating_score: number | null;
    avatar_url: string | null;
};

type ServiceStaffLink = { service_id: string; staff_id: string };

type UseBookingStep3StaffParams = {
    bookingData: BookingDataShape;
    setStaff: (staff: StaffItem[]) => void;
    setStaffId: (staffId: string) => void;
};

/**
 * Masters offered for the chosen service, by the rule the booking commands enforce
 * (_staff_performs_service): once a business links services to staff, only the masters linked
 * to the service; a business without any links keeps every master of the branch.
 */
export function filterStaffForService<T extends { id: string }>(
    staff: T[],
    links: ServiceStaffLink[],
    serviceId: string | null | undefined,
): T[] {
    if (!serviceId || links.length === 0) return staff;
    const performers = new Set(links.filter((link) => link.service_id === serviceId).map((link) => link.staff_id));
    return staff.filter((person) => performers.has(person.id));
}

export function useBookingStep3Staff({
    bookingData,
    setStaff,
    setStaffId,
}: UseBookingStep3StaffParams) {
    const bizId = bookingData.business?.id;
    const branchId = bookingData.branchId;
    const serviceId = bookingData.serviceId;
    const { data: staffData, isLoading } = useQuery<StaffItem[]>({
        queryKey: ['staff', bizId, branchId, serviceId ?? null],
        queryFn: async () => {
            if (!bizId || !branchId) {
                return [];
            }

            const [staffResult, linksResult] = await Promise.all([
                supabase
                    .from('staff')
                    .select('id, full_name, branch_id, rating_score, avatar_url')
                    .eq('biz_id', bizId)
                    .eq('branch_id', branchId)
                    .eq('is_active', true)
                    .order('rating_score', { ascending: false, nullsFirst: false })
                    .order('full_name'),
                supabase
                    .from('service_staff')
                    .select('service_id, staff_id, services!inner(biz_id)')
                    .eq('services.biz_id', bizId)
                    .eq('is_active', true),
            ]);

            if (staffResult.error) {
                throw staffResult.error;
            }
            if (linksResult.error) {
                throw linksResult.error;
            }

            return filterStaffForService(
                (staffResult.data || []) as StaffItem[],
                (linksResult.data || []) as ServiceStaffLink[],
                serviceId,
            );
        },
        enabled: !!bizId && !!branchId,
    });

    useEffect(() => {
        if (!staffData) {
            return;
        }

        setStaff(staffData);
        if (staffData.length === 1) {
            setStaffId(staffData[0].id);
        }
    }, [setStaff, setStaffId, staffData]);

    return {
        staffData,
        isLoading,
    };
}
