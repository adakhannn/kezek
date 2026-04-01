import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';

import { supabase } from '../../lib/supabase';

type BookingDataShape = {
    business?: { id?: string | null } | null;
    branchId?: string | null;
};

type StaffItem = {
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

export function useBookingStep3Staff({
    bookingData,
    setStaff,
    setStaffId,
}: UseBookingStep3StaffParams) {
    const { data: staffData, isLoading } = useQuery<StaffItem[]>({
        queryKey: ['staff', bookingData.business?.id, bookingData.branchId],
        queryFn: async () => {
            if (!bookingData.business?.id || !bookingData.branchId) {
                return [];
            }

            const { data, error } = await supabase
                .from('staff')
                .select('id, full_name, branch_id, rating_score, avatar_url')
                .eq('biz_id', bookingData.business.id)
                .eq('branch_id', bookingData.branchId)
                .eq('is_active', true)
                .order('rating_score', { ascending: false, nullsFirst: false })
                .order('full_name');

            if (error) {
                throw error;
            }

            return data || [];
        },
        enabled: !!bookingData.business?.id && !!bookingData.branchId,
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
