'use client';

import { addDays } from 'date-fns';
import type { ReadonlyURLSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';

import type { Branch, Service, Staff } from '../types';

import { logError } from '@/lib/log';
import { dateAtTz, formatDateInTz, getBusinessTimezone, todayStringInTz, todayTz } from '@/lib/time';

type UseBookingSelectionStateParams = {
    bizId: string;
    bizTz?: string | null;
    branches: Branch[];
    searchParams: ReadonlyURLSearchParams;
    services: Service[];
    staff: Staff[];
};

export function useBookingSelectionState({
    bizId,
    bizTz,
    branches,
    searchParams,
    services,
    staff,
}: UseBookingSelectionStateParams) {
    const businessTz = getBusinessTimezone(bizTz);
    const branchFromUrl = searchParams.get('branch');

    const [branchId, setBranchId] = useState<string>('');
    const [initialBranchSet, setInitialBranchSet] = useState(false);
    const [serviceIds, setServiceIds] = useState<string[]>([]);
    const [staffId, setStaffId] = useState<string>('');
    const [day, setDay] = useState<Date>(todayTz(businessTz));
    const [restoredFromStorage, setRestoredFromStorage] = useState(false);

    const urlRestoredRef = useRef(false);
    const skipBranchClearOnceRef = useRef(false);
    const skipDayClearOnceRef = useRef(false);

    const serviceId = serviceIds[0] ?? '';
    const dayStr = formatDateInTz(day, businessTz);
    const todayStr = todayStringInTz(businessTz);
    const maxStr = formatDateInTz(addDays(todayTz(businessTz), 60), businessTz);

    const servicesByBranch = useMemo(
        () => services.filter((service) => service.branch_id === branchId),
        [services, branchId],
    );
    const staffByBranch = useMemo(
        () => staff.filter((member) => member.branch_id === branchId),
        [staff, branchId],
    );

    useEffect(() => {
        if (!initialBranchSet && branchFromUrl) {
            const branchExists = branches.some((branch) => branch.id === branchFromUrl);
            if (branchExists) {
                setBranchId(branchFromUrl);
                setInitialBranchSet(true);
            }
        } else if (!initialBranchSet && !branchFromUrl) {
            setInitialBranchSet(true);
        }
    }, [branchFromUrl, branches, initialBranchSet]);

    useEffect(() => {
        if (restoredFromStorage) return;
        if (skipBranchClearOnceRef.current) {
            skipBranchClearOnceRef.current = false;
            return;
        }
        setStaffId('');
        setServiceIds([]);
    }, [branchId, restoredFromStorage]);

    useEffect(() => {
        if (urlRestoredRef.current) return;
        urlRestoredRef.current = true;

        const dayParam = searchParams.get('day');
        if (dayParam) {
            try {
                setDay(dateAtTz(dayParam, '00:00', businessTz));
            } catch {
                // ignore invalid date
            }
        }

        const staffParam = searchParams.get('staff');
        if (staffParam) {
            setStaffId(staffParam);
        }

        const servicesFromUrl = searchParams.getAll('service');
        if (servicesFromUrl.length > 0) {
            const valid = servicesFromUrl.filter((id) => services.some((service) => service.id === id));
            if (valid.length > 0) {
                setServiceIds(valid);
            }
        }

        skipBranchClearOnceRef.current = true;
        skipDayClearOnceRef.current = true;
    }, [searchParams, businessTz, services]);

    useEffect(() => {
        if (restoredFromStorage) return;
        if (skipDayClearOnceRef.current) {
            skipDayClearOnceRef.current = false;
            return;
        }
        setStaffId('');
        setServiceIds([]);
    }, [dayStr, restoredFromStorage]);

    const branchIds = useMemo(() => new Set(branches.map((branch) => branch.id)), [branches]);
    const serviceIdSet = useMemo(() => new Set(services.map((service) => service.id)), [services]);
    const staffIdSet = useMemo(() => new Set(staff.map((member) => member.id)), [staff]);

    useEffect(() => {
        if (restoredFromStorage) return;
        if (typeof window === 'undefined') return;

        try {
            const key = `booking_state_${bizId}`;
            const raw = window.localStorage.getItem(key);
            if (!raw) {
                setRestoredFromStorage(true);
                return;
            }

            const parsed = JSON.parse(raw) as {
                branchId?: string;
                day?: string;
                serviceId?: string;
                serviceIds?: string[];
                staffId?: string;
                step?: number;
            };

            if (parsed.branchId && branchIds.has(parsed.branchId)) {
                setBranchId(parsed.branchId);
            }

            const restoredServiceIds: string[] = [];
            if (Array.isArray(parsed.serviceIds)) {
                for (const id of parsed.serviceIds) {
                    if (typeof id === 'string' && serviceIdSet.has(id)) {
                        restoredServiceIds.push(id);
                    }
                }
            } else if (parsed.serviceId && serviceIdSet.has(parsed.serviceId)) {
                restoredServiceIds.push(parsed.serviceId);
            }
            if (restoredServiceIds.length > 0) {
                setServiceIds(restoredServiceIds);
            }

            if (parsed.staffId && staffIdSet.has(parsed.staffId)) {
                setStaffId(parsed.staffId);
            }

            if (parsed.day) {
                try {
                    setDay(dateAtTz(parsed.day, '00:00', businessTz));
                } catch {
                    // ignore invalid stored date
                }
            }

            window.localStorage.removeItem(key);
        } catch (error) {
            logError('Booking', 'restore booking state failed', error);
        } finally {
            setRestoredFromStorage(true);
        }
    }, [bizId, restoredFromStorage, branchIds, serviceIdSet, staffIdSet, businessTz]);

    return {
        branchId,
        businessTz,
        day,
        dayStr,
        maxStr,
        restoredFromStorage,
        serviceId,
        serviceIds,
        servicesByBranch,
        setBranchId,
        setDay,
        setServiceIds,
        setStaffId,
        staffByBranch,
        staffId,
        todayStr,
    };
}
