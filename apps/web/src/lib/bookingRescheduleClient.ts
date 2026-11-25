import { formatInTimeZone } from 'date-fns-tz';

import { acknowledgeBookingRequest, getBookingRequestHeaders } from '@/lib/bookingRequestClient';

/** The next `count` days of the business calendar, as yyyy-MM-dd. */
export function rescheduleDays(timeZone: string, count = 30, now: Date = new Date()): string[] {
    return Array.from({ length: count }, (_, index) =>
        formatInTimeZone(new Date(now.getTime() + index * 86_400_000), timeZone, 'yyyy-MM-dd'));
}

export type RescheduleSlot = { staff_id: string; branch_id: string; start_at: string; end_at: string };
type SlotsRpc = {
    rpc(name: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message: string } | null }>;
};

/** Slots offered from 30 minutes ahead, as the booking form does. */
const MIN_LEAD_MS = 30 * 60_000;

/**
 * Free starts of the same master for the booked duration on one day, in the booking's branch.
 * get_free_slots_complex_day_v1 takes any duration, so one source serves single and complex visits.
 * The booking's own time counts as taken there: starts overlapping it are not offered.
 */
export async function loadRescheduleSlots(
    supabase: SlotsRpc,
    booking: { bizId: string; branchId: string; staffId: string; startAt: string; durationMin: number },
    day: string,
    now: Date = new Date(),
): Promise<RescheduleSlot[]> {
    const { data, error } = await supabase.rpc('get_free_slots_complex_day_v1', {
        p_biz_id: booking.bizId, p_branch_id: null, p_staff_id: booking.staffId, p_day: day,
        p_duration_min: booking.durationMin, p_step_min: 15, p_per_staff: 400,
    });
    if (error) throw new Error(error.message);
    const minStart = now.getTime() + MIN_LEAD_MS;
    const current = Date.parse(booking.startAt);
    return ((data ?? []) as RescheduleSlot[])
        .filter((slot) => slot.staff_id === booking.staffId && slot.branch_id === booking.branchId &&
            Date.parse(slot.start_at) >= minStart && Date.parse(slot.start_at) !== current)
        .sort((a, b) => Date.parse(a.start_at) - Date.parse(b.start_at));
}

export type RescheduleOutcome =
    | { ok: true; startAt: string; endAt: string }
    | { ok: false; error: string; message: string | null };

/**
 * POST /api/bookings/[id]/reschedule with a stored Idempotency-Key: a lost response is retried
 * with the same key and answered from the receipt instead of moving the booking twice.
 */
export async function postBookingReschedule(
    bookingId: string,
    startAt: string,
    deps: { fetch?: typeof fetch; storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> } = {},
): Promise<RescheduleOutcome> {
    const input = { kind: 'reschedule', booking_id: bookingId, start_at: startAt };
    const storage = deps.storage ?? window.sessionStorage;
    const headers = await getBookingRequestHeaders(input, false, { storage });
    const response = await (deps.fetch ?? fetch)(`/api/bookings/${bookingId}/reschedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ start_at: startAt }),
    });
    const payload = await response.json().catch(() => null) as
        { ok?: boolean; data?: { start_at?: string; end_at?: string }; error?: string; message?: string } | null;
    if (response.ok && payload?.ok && payload.data?.start_at && payload.data.end_at) {
        try { await acknowledgeBookingRequest(input, false, headers, { storage }); } catch { /* Keep the replay identity. */ }
        return { ok: true, startAt: payload.data.start_at, endAt: payload.data.end_at };
    }
    // A definite refusal ends this attempt; an unknown outcome (503) keeps the key for a retry.
    if (response.status !== 503) {
        try { await acknowledgeBookingRequest(input, false, headers, { storage }); } catch { /* Keep the replay identity. */ }
    }
    return { ok: false, error: payload?.error ?? 'unknown', message: payload?.message ?? null };
}
