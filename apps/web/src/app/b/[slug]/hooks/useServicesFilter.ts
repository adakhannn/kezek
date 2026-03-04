import { filterServicesForStaff, resolveScheduleContext } from '@core-domain/schedule';
import { useMemo } from 'react';


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

type TemporaryTransfer = {
    staff_id: string;
    branch_id: string;
    date: string;
};

type StaffInfo = { id: string; branch_id: string };

/**
 * Хук для фильтрации услуг на основе выбранного мастера, филиала, даты и временных переводов.
 * Использует те же доменные правила, что и QuickDesk: resolveScheduleContext + filterServicesForStaff.
 */
export function useServicesFilter(params: {
    services: Service[];
    staffId: string;
    branchId: string;
    dayStr: string;
    staff: StaffInfo[];
    serviceToStaffMap: Map<string, Set<string>> | null;
    temporaryTransfers: TemporaryTransfer[];
}) {
    const { services, staffId, branchId, dayStr, staff, serviceToStaffMap, temporaryTransfers } =
        params;

    const servicesFiltered = useMemo<Service[]>(() => {
        if (!staffId) return [];
        if (!serviceToStaffMap) return [];

        const scheduleContext = resolveScheduleContext({
            staffId,
            dayStr,
            selectedBranchId: branchId,
            temporaryTransfers,
            staff,
        });

        return filterServicesForStaff({
            services,
            targetBranchId: scheduleContext.targetBranchId,
            staffId,
            serviceToStaffMap,
            isTemporaryTransfer: scheduleContext.isTemporaryTransfer,
        });
    }, [services, staffId, branchId, dayStr, staff, serviceToStaffMap, temporaryTransfers]);

    return servicesFiltered;
}

