'use client';

import type { ScheduleContext } from '@core-domain/schedule';
import { filterSlotsByContext } from '@core-domain/schedule';
import { addMinutes } from 'date-fns';
import { useCallback, useEffect, useState } from 'react';


import { getFreeSlotsForServiceDay, type DashboardSlot } from '@/lib/bookingDashboardService';
import { logDebug, logError } from '@/lib/log';

export type UseQuickDeskSlotsParams = {
    bizId: string;
    branchId: string;
    staffId: string;
    serviceId: string;
    date: string;
    scheduleContext: ScheduleContext | null;
};

export function useQuickDeskSlots(params: UseQuickDeskSlotsParams) {
    const { bizId, branchId, staffId, serviceId, date, scheduleContext } = params;

    const [slots, setSlots] = useState<DashboardSlot[]>([]);
    const [slotStartISO, setSlotStartISO] = useState('');
    const [slotsLoading, setSlotsLoading] = useState(false);

    const clearSlots = useCallback(() => {
        setSlots([]);
        setSlotStartISO('');
    }, []);

    useEffect(() => {
        const ctx = scheduleContext;
        if (!branchId || !serviceId || !date || !ctx) {
            setSlots([]);
            setSlotStartISO('');
            setSlotsLoading(false);
            return;
        }
        let ignore = false;
        setSlotsLoading(true);
        (async () => {
            let raw: DashboardSlot[];
            try {
                raw = await getFreeSlotsForServiceDay({
                    bizId,
                    serviceId,
                    day: date,
                    perStaff: 400,
                    stepMinutes: 15,
                });
            } catch (error: unknown) {
                if (ignore) return;
                logError('useQuickDeskSlots', 'get_free_slots_service_day_v2 error', error);
                setSlots([]);
                setSlotStartISO('');
                setSlotsLoading(false);
                return;
            }
            if (ignore) return;
            const now = new Date();
            const minTime = addMinutes(now, 30);
            const filtered = filterSlotsByContext(raw, {
                staffId: staffId || 'any',
                branchId,
                targetBranchId: ctx.targetBranchId,
                isTemporaryTransfer: ctx.isTemporaryTransfer,
                minStart: minTime,
            });
            if (ctx.isTemporaryTransfer) {
                logDebug('useQuickDeskSlots', 'Temporary transfer applied for slots', {
                    staffId,
                    date,
                    targetBranchId: ctx.targetBranchId,
                    selectedBranch: branchId,
                });
            }
            const uniq = Array.from(new Map(filtered.map((s) => [s.start_at, s])).values());
            setSlots(uniq);
            setSlotStartISO((prev) =>
                prev && uniq.some((u) => u.start_at === prev) ? prev : uniq[0]?.start_at ?? '',
            );
            setSlotsLoading(false);
        })();
        return () => {
            ignore = true;
        };
    }, [bizId, serviceId, staffId, date, branchId, scheduleContext]);

    return {
        slots,
        slotStartISO,
        setSlotStartISO,
        slotsLoading,
        clearSlots,
    };
}
