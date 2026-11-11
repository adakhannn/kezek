'use client';

import type { ScheduleContext } from '@core-domain/schedule';
import { filterSlotsByContext } from '@core-domain/schedule';
import { addMinutes } from 'date-fns';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SetStateAction } from 'react';

import { getFreeSlotsForServiceDay, type DashboardSlot } from '@/lib/bookingDashboardService';
import { logDebug, logError } from '@/lib/log';

export type UseQuickDeskSlotsParams = {
    bizId: string; branchId: string; staffId: string; serviceId: string; date: string;
    scheduleContext: ScheduleContext | null;
};
type RequestIdentity = { key: string };
type Snapshot = { request: RequestIdentity; slots: DashboardSlot[]; selected: string; resolved: boolean };
const EMPTY_SLOTS: DashboardSlot[] = [];

export function useQuickDeskSlots({ bizId, branchId, staffId, serviceId, date, scheduleContext }: UseQuickDeskSlotsParams) {
    const targetBranchId = scheduleContext?.targetBranchId ?? '';
    const isTemporaryTransfer = scheduleContext?.isTemporaryTransfer ?? false;
    const enabled = Boolean(bizId && branchId && staffId && staffId !== 'any' && serviceId && date && scheduleContext);
    const requestKey = JSON.stringify([bizId, branchId, staffId, serviceId, date, targetBranchId, isTemporaryTransfer, enabled]);
    const request = useMemo(() => ({ key: requestKey }), [requestKey]);
    const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
    const requestGeneration = useRef(0);
    const committedRequest = useRef(request);
    useEffect(() => { committedRequest.current = request; }, [request]);

    const clearSlots = useCallback(() => {
        // Clearing also invalidates an in-flight response; it must not restore a booked/reset slot.
        requestGeneration.current += 1;
        setSnapshot({ request: committedRequest.current, slots: [], selected: '', resolved: true });
    }, []);
    const setSlotStartISO = useCallback((value: SetStateAction<string>) => {
        const selectedRequest = committedRequest.current;
        setSnapshot(previous => {
            const current = previous?.request === selectedRequest ? previous : { request: selectedRequest, slots: [], selected: '', resolved: false };
            return { ...current, selected: typeof value === 'function' ? value(current.selected) : value };
        });
    }, []);

    useEffect(() => {
        if (!enabled) return;
        let ignore = false;
        const generation = ++requestGeneration.current;
        void getFreeSlotsForServiceDay({ bizId, serviceId, staffId, day: date, perStaff: 400, stepMinutes: 15 })
            .then(raw => {
                if (ignore || requestGeneration.current !== generation) return;
                const filtered = filterSlotsByContext(raw, { staffId: staffId || 'any', branchId, targetBranchId,
                    isTemporaryTransfer, minStart: addMinutes(new Date(), 30) });
                if (isTemporaryTransfer) logDebug('useQuickDeskSlots', 'Temporary transfer applied for slots', { staffId, date, targetBranchId, selectedBranch: branchId });
                const slots = Array.from(new Map(filtered.map(slot => [slot.start_at, slot])).values());
                setSnapshot(previous => {
                    const selected = previous?.request === request ? previous.selected : '';
                    return { request, slots, resolved: true, selected: selected && slots.some(slot => slot.start_at === selected) ? selected : slots[0]?.start_at ?? '' };
                });
            })
            .catch(error => {
                if (ignore || requestGeneration.current !== generation) return;
                logError('useQuickDeskSlots', 'get_free_slots_service_day_v2 error', error);
                setSnapshot({ request, slots: [], selected: '', resolved: true });
            });
        return () => { ignore = true; };
    }, [bizId, branchId, staffId, serviceId, date, targetBranchId, isTemporaryTransfer, enabled, request]);

    const current = enabled && snapshot?.request === request ? snapshot : null;
    return { slots: current?.slots ?? EMPTY_SLOTS, slotStartISO: current?.selected ?? '', setSlotStartISO,
        slotsLoading: enabled && !current?.resolved, clearSlots };
}
