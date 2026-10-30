'use client';

import { useSyncExternalStore } from 'react';

import { todayStringInTz } from '@/lib/time';

const CHANGE_EVENT = 'kezek:booking-calendar';

function subscribe(onChange: () => void) {
    window.addEventListener(CHANGE_EVENT, onChange);
    window.addEventListener('popstate', onChange);
    return () => {
        window.removeEventListener(CHANGE_EVENT, onChange);
        window.removeEventListener('popstate', onChange);
    };
}

function getSnapshot() {
    const saved = window.history.state?.kezekBookingCalendar;
    return JSON.stringify([
        typeof saved?.bizId === 'string' ? saved.bizId : null,
        typeof saved?.date === 'string' ? saved.date : null,
        typeof saved?.branchId === 'string' ? saved.branchId : null,
    ]);
}

function validDate(value: unknown): value is string {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const parsed = new Date(`${value}T00:00:00Z`);
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

// Only UI filters belong to this history entry. Never copy auth/session state.
export function useCalendarHistory(bizId: string, timezone: string, branches: { id: string }[]) {
    const snapshot = useSyncExternalStore(subscribe, getSnapshot, () => 'null');
    const saved: [string | null, string | null, string | null] | null = JSON.parse(snapshot);
    const sameBusiness = saved?.[0] === bizId;
    const date = sameBusiness && validDate(saved?.[1]) ? saved[1] : todayStringInTz(timezone);
    const branchId = sameBusiness && branches.some((branch) => branch.id === saved?.[2]) ? saved![2]! : 'all';

    function update(nextDate: string, nextBranchId: string) {
        window.history.replaceState({
            ...window.history.state,
            kezekBookingCalendar: { bizId, date: nextDate, branchId: nextBranchId },
        }, '');
        window.dispatchEvent(new Event(CHANGE_EVENT));
    }

    return {
        date,
        selectedBranchId: branchId,
        setDate: (value: string) => update(value, branchId),
        setSelectedBranchId: (value: string) => update(date, value),
    };
}
