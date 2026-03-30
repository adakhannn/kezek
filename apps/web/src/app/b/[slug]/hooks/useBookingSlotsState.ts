'use client';

import { resolveScheduleContext } from '@core-domain/schedule';
import { useEffect, useState } from 'react';

import type { Service, ServiceStaffRow, Slot, Staff } from '../types';

import { useSlotsLoader } from './useSlotsLoader';

import { logDebug, logWarn } from '@/lib/log';
import { supabase } from '@/lib/supabaseClient';

type TranslateFn = (key: string, fallback?: string) => string;

type TransferRow = {
    branch_id: string;
    date: string;
    staff_id: string;
};

type UseBookingSlotsStateParams = {
    bizId: string;
    branchId: string;
    dayStr: string;
    serviceId: string;
    serviceIds: string[];
    servicesFiltered: Service[];
    serviceStaff: ServiceStaffRow[] | null;
    staff: Staff[];
    staffForSchedule: Array<{ branch_id: string; id: string }>;
    staffId: string;
    t: TranslateFn;
    temporaryTransfers: TransferRow[];
};

export function useBookingSlotsState({
    bizId,
    branchId,
    dayStr,
    serviceId,
    serviceIds,
    servicesFiltered,
    serviceStaff,
    staff,
    staffForSchedule,
    staffId,
    t,
    temporaryTransfers,
}: UseBookingSlotsStateParams) {
    const [slotsRefreshKey, setSlotsRefreshKey] = useState(0);
    const [slots, setSlots] = useState<Slot[]>([]);

    const { error: slotsError, loading: slotsLoading, slots: slotsFromHook } = useSlotsLoader({
        branchId,
        bizId,
        dayStr,
        serviceIds,
        serviceStaff,
        servicesFiltered,
        slotsRefreshKey,
        staff,
        staffId,
        t,
        temporaryTransfers,
    });

    useEffect(() => {
        if (!slotsFromHook.length) {
            setSlots([]);
            return;
        }

        let ignore = false;

        (async () => {
            try {
                const scheduleContext = resolveScheduleContext({
                    dayStr,
                    selectedBranchId: branchId,
                    staff: staffForSchedule,
                    staffId,
                    temporaryTransfers,
                });
                const targetBranchId = scheduleContext.targetBranchId;

                const dayStartUTC = new Date(`${dayStr}T00:00:00Z`);
                const dayEndUTC = new Date(`${dayStr}T23:59:59.999Z`);
                const searchStart = new Date(dayStartUTC.getTime() - 12 * 60 * 60 * 1000);
                const searchEnd = new Date(dayEndUTC.getTime() + 12 * 60 * 60 * 1000);

                const { data: existingBookings, error: bookingsError } = await supabase
                    .from('bookings')
                    .select('start_at, end_at, status')
                    .eq('staff_id', staffId)
                    .eq('branch_id', targetBranchId)
                    .not('status', 'eq', 'cancelled')
                    .gte('start_at', searchStart.toISOString())
                    .lte('end_at', searchEnd.toISOString());

                if (ignore) return;

                if (bookingsError) {
                    logWarn('Booking', 'Error loading bookings for filtering', bookingsError);
                    setSlots(slotsFromHook);
                    return;
                }

                if (existingBookings && existingBookings.length > 0) {
                    logDebug('Booking', 'Filtering slots, found existing bookings', { count: existingBookings.length });
                    const filtered = slotsFromHook.filter((slot) => {
                        const slotStart = new Date(slot.start_at);
                        const slotEnd = new Date(slot.end_at);

                        const overlaps = existingBookings.some((booking: { end_at: string; start_at: string; status: string }) => {
                            const bookingStart = new Date(booking.start_at);
                            const bookingEnd = new Date(booking.end_at);
                            const hasOverlap = slotStart < bookingEnd && slotEnd > bookingStart;

                            if (hasOverlap) {
                                logDebug('Booking', 'Slot overlaps with booking', {
                                    booking: { end: bookingEnd.toISOString(), start: bookingStart.toISOString(), status: booking.status },
                                    slot: { end: slotEnd.toISOString(), start: slotStart.toISOString() },
                                });
                            }

                            return hasOverlap;
                        });

                        return !overlaps;
                    });

                    logDebug('Booking', 'Filtered slots', { filtered: filtered.length, total: slotsFromHook.length });
                    setSlots(filtered);
                } else {
                    logDebug('Booking', 'No existing bookings found, showing all slots');
                    setSlots(slotsFromHook);
                }
            } catch (error) {
                if (!ignore) {
                    logWarn('Booking', 'Error filtering slots by bookings', error);
                    setSlots(slotsFromHook);
                }
            }
        })();

        return () => {
            ignore = true;
        };
    }, [branchId, dayStr, slotsFromHook, staffForSchedule, staffId, temporaryTransfers]);

    useEffect(() => {
        let lastUpdate = 0;

        const handleVisibilityChange = () => {
            const now = Date.now();
            if (now - lastUpdate < 2000) return;

            if (document.visibilityState === 'visible' && serviceId && staffId && dayStr) {
                lastUpdate = now;
                setSlotsRefreshKey((current) => current + 1);
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [dayStr, serviceId, staffId]);

    return {
        refreshSlots: () => setSlotsRefreshKey((current) => current + 1),
        slots,
        slotsError,
        slotsLoading,
    };
}
