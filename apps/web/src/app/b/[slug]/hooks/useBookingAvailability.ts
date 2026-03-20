import { useEffect, useMemo } from 'react';
import { filterStaffByBookingAvailability } from '@core-domain/schedule';

import { useServiceStaff } from './useBookingData';
import { useServicesFilter } from './useServicesFilter';
import type { Service, ServiceStaffRow, Staff } from '../types';

import { logDebug, logWarn } from '@/lib/log';

type TemporaryTransfer = {
    staff_id: string;
    branch_id: string;
    date: string;
};

type UseBookingAvailabilityArgs = {
    bizId: string;
    branchId: string;
    dayStr: string;
    serviceId: string;
    staffId: string;
    staff: Staff[];
    services: Service[];
    servicesByBranch: Service[];
    staffByBranch: Staff[];
    temporaryTransfers: TemporaryTransfer[];
    onInvalidService: () => void;
};

export function useBookingAvailability({
    bizId,
    branchId,
    dayStr,
    serviceId,
    staffId,
    staff,
    services,
    servicesByBranch,
    staffByBranch,
    temporaryTransfers,
    onInvalidService,
}: UseBookingAvailabilityArgs) {
    const staffIds = useMemo(() => staff.map((member) => member.id), [staff]);
    const { data: serviceStaffData, isLoading: serviceStaffLoading } = useServiceStaff(bizId, staffIds);
    const serviceStaff: ServiceStaffRow[] | null = serviceStaffLoading ? null : (serviceStaffData || null);

    const serviceToStaffMap = useMemo(() => {
        if (!serviceStaff || serviceStaff.length === 0) return null;

        const map = new Map<string, Set<string>>();
        for (const row of serviceStaff) {
            if (!row.is_active) continue;
            if (!map.has(row.service_id)) map.set(row.service_id, new Set());
            map.get(row.service_id)?.add(row.staff_id);
        }
        return map;
    }, [serviceStaff]);

    const staffForSchedule = useMemo(
        () => staff.map((member) => ({ id: member.id, branch_id: member.branch_id })),
        [staff],
    );

    const servicesFiltered = useServicesFilter({
        services,
        staffId,
        branchId,
        dayStr,
        staff: staffForSchedule,
        serviceToStaffMap,
        temporaryTransfers,
    });

    useEffect(() => {
        if (!staffId || !dayStr) {
            if (!staffId) logDebug('Booking', 'Staff cleared, clearing service');
            if (!dayStr) logDebug('Booking', 'Day cleared, clearing service');
            onInvalidService();
            return;
        }

        if (serviceId) {
            const isServiceValid = servicesFiltered.some((service) => service.id === serviceId);
            logDebug('Booking', 'Checking service validity after staff/day change', {
                serviceId,
                staffId,
                dayStr,
                isServiceValid,
                servicesFilteredCount: servicesFiltered.length,
                servicesFiltered: servicesFiltered.map((service) => ({ id: service.id, name: service.name_ru })),
            });
            if (!isServiceValid) {
                logWarn('Booking', 'Service is not valid for current staff/day, clearing serviceId');
                onInvalidService();
            }
        }
    }, [staffId, dayStr, servicesFiltered, serviceId, onInvalidService]);

    const staffFiltered = useMemo<Staff[]>(
        () =>
            filterStaffByBookingAvailability({
                staff,
                staffByBranch,
                branchId,
                dayStr,
                temporaryTransfers,
            }),
        [staffByBranch, staff, branchId, temporaryTransfers, dayStr],
    );

    const service = useMemo(() => {
        const found =
            servicesFiltered.find((item) => item.id === serviceId) ??
            servicesByBranch.find((item) => item.id === serviceId) ??
            services.find((item) => item.id === serviceId);

        logDebug('Booking', 'Finding service', {
            serviceId,
            found: found ? found.name_ru : null,
            foundInFiltered: !!servicesFiltered.find((item) => item.id === serviceId),
            foundInBranch: !!servicesByBranch.find((item) => item.id === serviceId),
            foundInAll: !!services.find((item) => item.id === serviceId),
        });

        return found ?? null;
    }, [servicesFiltered, servicesByBranch, services, serviceId]);

    return {
        serviceStaff,
        staffForSchedule,
        servicesFiltered,
        staffFiltered,
        service,
    };
}
