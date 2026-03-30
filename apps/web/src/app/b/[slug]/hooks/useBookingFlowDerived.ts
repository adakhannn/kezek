'use client';

import { format, type Locale } from 'date-fns';
import { useEffect, useMemo } from 'react';

import type { Service, Staff } from '../types';

import { logDebug, logWarn } from '@/lib/log';

type TransferRow = {
    branch_id: string;
    date: string;
    staff_id: string;
};

type UseBookingFlowDerivedParams = {
    branchId: string;
    day: Date;
    dayStr: string;
    dateLocale: Locale;
    serviceId: string;
    serviceIds: string[];
    services: Service[];
    servicesByBranch: Service[];
    servicesFiltered: Service[];
    setServiceIds: React.Dispatch<React.SetStateAction<string[]>>;
    staff: Staff[];
    staffByBranch: Staff[];
    staffId: string;
    temporaryTransfers: TransferRow[];
};

export function useBookingFlowDerived({
    branchId,
    day,
    dayStr,
    dateLocale,
    serviceId,
    serviceIds,
    services,
    servicesByBranch,
    servicesFiltered,
    setServiceIds,
    staff,
    staffByBranch,
    staffId,
    temporaryTransfers,
}: UseBookingFlowDerivedParams) {
    useEffect(() => {
        if (!staffId || !dayStr) {
            if (!staffId) logDebug('Booking', 'Staff cleared, clearing services');
            if (!dayStr) logDebug('Booking', 'Day cleared, clearing services');
            setServiceIds((prev) => (prev.length > 0 ? [] : prev));
            return;
        }

        setServiceIds((prev) => {
            if (prev.length === 0) return prev;
            const validIds = prev.filter((id) => servicesFiltered.some((service) => service.id === id));
            const wasChanged = validIds.length !== prev.length;

            logDebug('Booking', 'Checking services validity after staff/day change', {
                dayStr,
                serviceIds: prev,
                servicesFilteredCount: servicesFiltered.length,
                staffId,
                validIds,
            });

            if (validIds.length === 0) {
                logWarn('Booking', 'Selected services are not valid for current staff/day, clearing serviceIds');
                return [];
            }

            return wasChanged ? validIds : prev;
        });
    }, [dayStr, servicesFiltered, setServiceIds, staffId]);

    const staffFiltered = useMemo<Staff[]>(() => {
        if (!branchId) return [];

        const mainStaff = staffByBranch;
        const mainStaffIds = new Set(mainStaff.map((member) => member.id));

        if (dayStr) {
            const transfersToThisBranch = temporaryTransfers.filter(
                (transfer) => transfer.date === dayStr && transfer.branch_id === branchId,
            );
            const tempStaffIdsToThisBranch = new Set(transfersToThisBranch.map((transfer) => transfer.staff_id));

            const transfersToOtherBranch = temporaryTransfers.filter(
                (transfer) => transfer.date === dayStr && transfer.branch_id !== branchId,
            );
            const tempStaffIdsToOtherBranch = new Set(transfersToOtherBranch.map((transfer) => transfer.staff_id));

            const allStaffIds = new Set([...mainStaffIds, ...tempStaffIdsToThisBranch]);

            return staff.filter((member) => {
                const isIncluded = allStaffIds.has(member.id);
                const isTransferredToOther = tempStaffIdsToOtherBranch.has(member.id);
                return isIncluded && !isTransferredToOther;
            });
        }

        return mainStaff;
    }, [branchId, dayStr, staff, staffByBranch, temporaryTransfers]);

    const service = useMemo(() => {
        const found = servicesFiltered.find((item) => item.id === serviceId)
            ?? servicesByBranch.find((item) => item.id === serviceId)
            ?? services.find((item) => item.id === serviceId);

        logDebug('Booking', 'Finding service', {
            found: found ? found.name_ru : null,
            foundInAll: !!services.find((item) => item.id === serviceId),
            foundInBranch: !!servicesByBranch.find((item) => item.id === serviceId),
            foundInFiltered: !!servicesFiltered.find((item) => item.id === serviceId),
            serviceId,
        });

        return found ?? null;
    }, [serviceId, services, servicesByBranch, servicesFiltered]);

    const selectedServicesForStep4 = useMemo(
        () => servicesFiltered.filter((serviceItem) => serviceIds.includes(serviceItem.id)),
        [serviceIds, servicesFiltered],
    );

    const { totalDurationStep4, totalPriceFromStep4, totalPriceToStep4 } = useMemo(() => {
        let duration = 0;
        let from = 0;
        let to = 0;

        for (const serviceItem of selectedServicesForStep4) {
            duration += serviceItem.duration_min;
            if (typeof serviceItem.price_from === 'number') from += serviceItem.price_from;
            if (typeof serviceItem.price_to === 'number') to += serviceItem.price_to;
        }

        return { totalDurationStep4: duration, totalPriceFromStep4: from, totalPriceToStep4: to };
    }, [selectedServicesForStep4]);

    const servicesForBooking = selectedServicesForStep4.length > 0
        ? selectedServicesForStep4
        : service
            ? [service]
            : [];

    const staffCurrent = useMemo(
        () => staff.find((member) => member.id === staffId) ?? null,
        [staff, staffId],
    );

    const dayLabel = useMemo(() => {
        const dateStr = format(day, 'dd.MM.yyyy', { locale: dateLocale });
        const weekdayStr = format(day, 'EEEE', { locale: dateLocale });
        return `${dateStr} (${weekdayStr})`;
    }, [dateLocale, day]);

    return {
        dayLabel,
        selectedServicesForStep4,
        service,
        serviceCurrent: service,
        servicesForBooking,
        staffCurrent,
        staffFiltered,
        totalDurationStep4,
        totalPriceFromStep4,
        totalPriceToStep4,
    };
}
