import { addDays } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { useEffect, useMemo, useRef, useState } from 'react';

import type { Branch, Service, Staff } from '../types';
import { useBookingUrlState } from './useBookingUrlState';

import { dateAtTz, getBusinessTimezone, todayTz } from '@/lib/time';

type RouterLike = {
    replace: (href: string, options?: { scroll?: boolean }) => void;
};

type SearchParamsLike = {
    get: (key: string) => string | null;
};

type UseBookingSelectionStateArgs = {
    bizId: string;
    bizTz?: string | null;
    branches: Branch[];
    services: Service[];
    staff: Staff[];
    pathname: string;
    router: RouterLike;
    searchParams: SearchParamsLike;
};

export function useBookingSelectionState({
    bizId,
    bizTz,
    branches,
    services,
    staff,
    pathname,
    router,
    searchParams,
}: UseBookingSelectionStateArgs) {
    const businessTz = getBusinessTimezone(bizTz);
    const {
        initialSelection,
        restoredFromStorage,
        persistSelectionForAuth: persistSelectionSnapshot,
        syncSelectionToUrl: syncSelectionSnapshotToUrl,
    } = useBookingUrlState({
        bizId,
        branches,
        services,
        staff,
        pathname,
        router,
        searchParams,
    });

    const [branchId, setBranchId] = useState<string>('');
    const [serviceId, setServiceId] = useState<string>('');
    const [staffId, setStaffId] = useState<string>('');
    const [day, setDay] = useState<Date>(todayTz(businessTz));
    const initialSelectionAppliedRef = useRef(false);
    const skipBranchClearOnceRef = useRef(false);
    const skipDayClearOnceRef = useRef(false);

    const dayStr = formatInTimeZone(day, businessTz, 'yyyy-MM-dd');
    const todayStr = formatInTimeZone(todayTz(businessTz), businessTz, 'yyyy-MM-dd');
    const maxStr = formatInTimeZone(addDays(todayTz(businessTz), 60), businessTz, 'yyyy-MM-dd');

    const servicesByBranch = useMemo(
        () => services.filter((service) => service.branch_id === branchId),
        [services, branchId]
    );
    const staffByBranch = useMemo(
        () => staff.filter((member) => member.branch_id === branchId),
        [staff, branchId]
    );

    useEffect(() => {
        if (restoredFromStorage) return;
        if (skipBranchClearOnceRef.current) {
            skipBranchClearOnceRef.current = false;
            return;
        }
        setStaffId('');
        setServiceId('');
    }, [branchId, restoredFromStorage]);

    useEffect(() => {
        if (!initialSelection || initialSelectionAppliedRef.current) return;

        if (initialSelection.branchId) {
            setBranchId(initialSelection.branchId);
        }
        if (initialSelection.serviceId) {
            setServiceId(initialSelection.serviceId);
        }
        if (initialSelection.staffId) {
            setStaffId(initialSelection.staffId);
        }
        if (initialSelection.day) {
            try {
                setDay(dateAtTz(initialSelection.day, '00:00', businessTz));
            } catch {
                // Ignore invalid restored date.
            }
        }

        skipBranchClearOnceRef.current = true;
        skipDayClearOnceRef.current = true;
        initialSelectionAppliedRef.current = true;
    }, [businessTz, initialSelection]);

    useEffect(() => {
        if (restoredFromStorage) return;
        if (skipDayClearOnceRef.current) {
            skipDayClearOnceRef.current = false;
            return;
        }
        setStaffId('');
        setServiceId('');
    }, [dayStr, restoredFromStorage]);

    const persistSelectionForAuth = (step: number) => {
        persistSelectionSnapshot({
            branchId,
            serviceId,
            staffId,
            dayStr,
        }, step);
    };

    const syncSelectionToUrl = (step: number) => {
        syncSelectionSnapshotToUrl({
            branchId,
            serviceId,
            staffId,
            dayStr,
        }, step);
    };

    return {
        branchId,
        setBranchId,
        serviceId,
        setServiceId,
        staffId,
        setStaffId,
        day,
        setDay,
        dayStr,
        todayStr,
        maxStr,
        businessTz,
        restoredFromStorage,
        servicesByBranch,
        staffByBranch,
        persistSelectionForAuth,
        syncSelectionToUrl,
    };
}
