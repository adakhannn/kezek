import { resolveScheduleContext } from '@core-domain/schedule';
import { useEffect, useState } from 'react';

import type { Slot } from '../types';

import { logDebug, logWarn } from '@/lib/log';
import { supabase } from '@/lib/supabaseClient';

type TemporaryTransfer = {
    staff_id: string;
    branch_id: string;
    date: string;
};

type ScheduleStaff = {
    id: string;
    branch_id: string;
};

type BookingRecord = {
    start_at: string;
    end_at: string;
    status: string;
};

type UseBookingVisibleSlotsArgs = {
    branchId: string;
    dayStr: string;
    slotsFromHook: Slot[];
    staffForSchedule: ScheduleStaff[];
    staffId: string;
    temporaryTransfers: TemporaryTransfer[];
};

function filterOverlappingSlots(slots: Slot[], bookings: BookingRecord[]) {
    return slots.filter((slot) => {
        const slotStart = new Date(slot.start_at);
        const slotEnd = new Date(slot.end_at);

        const overlaps = bookings.some((booking) => {
            const bookingStart = new Date(booking.start_at);
            const bookingEnd = new Date(booking.end_at);
            const hasOverlap = slotStart < bookingEnd && slotEnd > bookingStart;

            if (hasOverlap) {
                logDebug('Booking', 'Slot overlaps with booking', {
                    slot: { start: slotStart.toISOString(), end: slotEnd.toISOString() },
                    booking: { start: bookingStart.toISOString(), end: bookingEnd.toISOString(), status: booking.status },
                });
            }

            return hasOverlap;
        });

        return !overlaps;
    });
}

export function useBookingVisibleSlots({
    branchId,
    dayStr,
    slotsFromHook,
    staffForSchedule,
    staffId,
    temporaryTransfers,
}: UseBookingVisibleSlotsArgs) {
    const [slots, setSlots] = useState<Slot[]>([]);

    useEffect(() => {
        if (!slotsFromHook.length) {
            setSlots([]);
            return;
        }

        let ignore = false;

        (async () => {
            try {
                const scheduleContext = resolveScheduleContext({
                    staffId,
                    dayStr,
                    selectedBranchId: branchId,
                    temporaryTransfers,
                    staff: staffForSchedule,
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
                    const filtered = filterOverlappingSlots(slotsFromHook, existingBookings);
                    logDebug('Booking', 'Filtered slots', { filtered: filtered.length, total: slotsFromHook.length });
                    setSlots(filtered);
                    return;
                }

                logDebug('Booking', 'No existing bookings found, showing all slots');
                setSlots(slotsFromHook);
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

    return { slots };
}
