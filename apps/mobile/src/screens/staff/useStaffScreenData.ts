import { useState } from 'react';

import { useCurrentStaff } from '../../hooks/useCurrentStaff';
import type { StaffBookingsTab } from './types';
import { useStaffBookings } from './useStaffBookings';

export function useStaffScreenData() {
    const [refreshing, setRefreshing] = useState(false);
    const [tab, setTab] = useState<StaffBookingsTab>('upcoming');
    const currentStaff = useCurrentStaff();
    const staffId = currentStaff.staffInfo?.id;
    const bookings = useStaffBookings(staffId, tab);

    const onRefresh = async () => {
        setRefreshing(true);
        try {
            await Promise.all([currentStaff.refetch(), bookings.refetch()]);
        } finally {
            setRefreshing(false);
        }
    };

    return {
        staffInfo: currentStaff.staffInfo,
        staffRecords: currentStaff.staffRecords,
        needsSelection: currentStaff.needsSelection,
        selectStaff: currentStaff.select,
        tab,
        setTab,
        bookings,
        // A failed bookings read is shown inside the list (with its retry); the workspace stays usable.
        loadError: currentStaff.error,
        isLoading: currentStaff.isLoading && !refreshing,
        refreshing,
        onRefresh,
    };
}
