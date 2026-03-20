import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { Branch, Service, Staff } from '../types';

type RouterLike = {
    replace: (href: string, options?: { scroll?: boolean }) => void;
};

type SearchParamsLike = {
    get: (key: string) => string | null;
};

type SelectionSnapshot = {
    branchId: string;
    serviceId: string;
    staffId: string;
    dayStr: string;
};

type InitialSelection = {
    branchId?: string;
    serviceId?: string;
    staffId?: string;
    day?: string;
};

type UseBookingUrlStateArgs = {
    bizId: string;
    branches: Branch[];
    services: Service[];
    staff: Staff[];
    pathname: string;
    router: RouterLike;
    searchParams: SearchParamsLike;
};

export function useBookingUrlState({
    bizId,
    branches,
    services,
    staff,
    pathname,
    router,
    searchParams,
}: UseBookingUrlStateArgs) {
    const [initialSelection, setInitialSelection] = useState<InitialSelection | null>(null);
    const [restoredFromStorage, setRestoredFromStorage] = useState(false);
    const restoredRef = useRef(false);

    const branchIds = useMemo(() => new Set(branches.map((branch) => branch.id)), [branches]);
    const serviceIds = useMemo(() => new Set(services.map((service) => service.id)), [services]);
    const staffIds = useMemo(() => new Set(staff.map((member) => member.id)), [staff]);

    useEffect(() => {
        if (restoredRef.current) return;
        restoredRef.current = true;

        const nextSelection: InitialSelection = {};
        const branchFromUrl = searchParams.get('branch');
        if (branchFromUrl && branchIds.has(branchFromUrl)) {
            nextSelection.branchId = branchFromUrl;
        }

        const dayFromUrl = searchParams.get('day');
        if (dayFromUrl) nextSelection.day = dayFromUrl;

        const staffFromUrl = searchParams.get('staff');
        if (staffFromUrl && staffIds.has(staffFromUrl)) {
            nextSelection.staffId = staffFromUrl;
        }

        const serviceFromUrl = searchParams.get('service');
        if (serviceFromUrl && serviceIds.has(serviceFromUrl)) {
            nextSelection.serviceId = serviceFromUrl;
        }

        if (typeof window !== 'undefined') {
            try {
                const raw = window.localStorage.getItem(`booking_state_${bizId}`);
                if (raw) {
                    const persisted = JSON.parse(raw) as InitialSelection;
                    if (persisted.branchId && branchIds.has(persisted.branchId)) {
                        nextSelection.branchId = persisted.branchId;
                    }
                    if (persisted.serviceId && serviceIds.has(persisted.serviceId)) {
                        nextSelection.serviceId = persisted.serviceId;
                    }
                    if (persisted.staffId && staffIds.has(persisted.staffId)) {
                        nextSelection.staffId = persisted.staffId;
                    }
                    if (persisted.day) {
                        nextSelection.day = persisted.day;
                    }
                    window.localStorage.removeItem(`booking_state_${bizId}`);
                    setRestoredFromStorage(true);
                }
            } finally {
                setRestoredFromStorage(true);
            }
        } else {
            setRestoredFromStorage(true);
        }

        setInitialSelection(nextSelection);
    }, [bizId, branchIds, searchParams, serviceIds, staffIds]);

    const persistSelectionForAuth = useCallback((selection: SelectionSnapshot, step: number) => {
        if (typeof window === 'undefined') return;

        window.localStorage.setItem(
            `booking_state_${bizId}`,
            JSON.stringify({
                ...selection,
                day: selection.dayStr,
                step,
            }),
        );
    }, [bizId]);

    const syncSelectionToUrl = useCallback((selection: SelectionSnapshot, step: number) => {
        const next = new URLSearchParams();
        next.set('step', String(step));
        if (selection.branchId) next.set('branch', selection.branchId);
        if (selection.dayStr) next.set('day', selection.dayStr);
        if (selection.staffId) next.set('staff', selection.staffId);
        if (selection.serviceId) next.set('service', selection.serviceId);

        const query = next.toString();
        router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    }, [pathname, router]);

    return {
        initialSelection,
        restoredFromStorage,
        persistSelectionForAuth,
        syncSelectionToUrl,
    };
}
