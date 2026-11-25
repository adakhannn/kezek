import { formatInTimeZone } from 'date-fns-tz';

import { apiRequest } from './api';
import { acknowledgeBookingRequest, getBookingRequestKey } from './bookingRequest';
import { supabase } from './supabase';

export type RescheduleSlot = { staff_id: string; branch_id: string; start_at: string; end_at: string };

export type RescheduleTarget = {
    bizId: string;
    branchId: string;
    staffId: string;
    startAt: string;
    endAt: string;
};

/** Slots offered from 30 minutes ahead, as the booking flow does. */
const MIN_LEAD_MS = 30 * 60_000;

/** The booked duration in minutes: the reschedule command keeps end_at - start_at. */
export function bookedDurationMin(target: Pick<RescheduleTarget, 'startAt' | 'endAt'>): number {
    return Math.max(1, Math.round((Date.parse(target.endAt) - Date.parse(target.startAt)) / 60_000));
}

/** The next `count` days of the business calendar, as yyyy-MM-dd. */
export function rescheduleDays(timeZone: string, count = 30, now: Date = new Date()): string[] {
    return Array.from({ length: count }, (_, index) =>
        formatInTimeZone(new Date(now.getTime() + index * 86_400_000), timeZone, 'yyyy-MM-dd'));
}

/**
 * Free starts of the same master for the booked duration on one day, in the booking's branch.
 * get_free_slots_complex_day_v1 takes any duration, so one source serves single and complex visits;
 * the booking's own time counts as taken there.
 */
export async function loadRescheduleSlots(target: RescheduleTarget, day: string, now: Date = new Date()): Promise<RescheduleSlot[]> {
    const { data, error } = await supabase.rpc('get_free_slots_complex_day_v1', {
        p_biz_id: target.bizId,
        p_branch_id: null,
        p_staff_id: target.staffId,
        p_day: day,
        p_duration_min: bookedDurationMin(target),
        p_step_min: 15,
        p_per_staff: 400,
    });
    if (error) throw error;
    const minStart = now.getTime() + MIN_LEAD_MS;
    const current = Date.parse(target.startAt);
    return ((data ?? []) as RescheduleSlot[])
        .filter((slot) => slot.staff_id === target.staffId && slot.branch_id === target.branchId &&
            Date.parse(slot.start_at) >= minStart && Date.parse(slot.start_at) !== current)
        .sort((a, b) => Date.parse(a.start_at) - Date.parse(b.start_at));
}

type RescheduleResponse = { ok?: boolean; data?: { start_at?: string; end_at?: string; rescheduled?: boolean } };

/**
 * POST /api/bookings/[id]/reschedule (Bearer) with an Idempotency-Key bound to the account and the
 * new start: a lost response is retried with the same key and answered from the server receipt.
 */
export async function rescheduleBookingRequest(userId: string, bookingId: string, startAt: string) {
    const input = { kind: 'reschedule', booking_id: bookingId, start_at: startAt };
    const requestId = await getBookingRequestKey(userId, input);
    const response = await apiRequest<RescheduleResponse>(`/api/bookings/${bookingId}/reschedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': requestId },
        body: JSON.stringify({ start_at: startAt }),
    });
    if (response?.data?.rescheduled !== true) throw new Error('Reschedule result is unavailable');
    try { await acknowledgeBookingRequest(userId, input, requestId); } catch { /* Keep the replay identity. */ }
    return { startAt: response.data.start_at ?? startAt, endAt: response.data.end_at ?? null };
}
