import { clientBookingActions } from '@core-domain/booking';

import { loadRescheduleSlots, postBookingReschedule, rescheduleDays } from '@/lib/bookingRescheduleClient';

const now = new Date('2040-01-01T06:00:00Z');

describe('clientBookingActions (R25-10)', () => {
    const none = { started: false, canCancel: false, canReschedule: false, rescheduleNeedsBusiness: false };
    test.each([
        ['confirmed', '2040-01-01T07:00:00Z', null, { ...none, canCancel: true, canReschedule: true }],
        ['confirmed', '2040-01-01T06:00:00Z', null, { ...none, started: true }],
        ['hold', '2040-01-01T05:00:00Z', null, { ...none, started: true }],
        ['hold', '2040-01-01T07:00:00Z', null, { ...none, canCancel: true }],
        ['confirmed', '2040-01-01T07:00:00Z', {}, { ...none, canCancel: true, rescheduleNeedsBusiness: true }],
        ['paid', '2040-01-01T05:00:00Z', null, none],
        ['cancelled', '2040-01-01T07:00:00Z', null, none],
    ])('%s starting %s (benefit %o)', (status, startAt, promotionApplied, expected) => {
        expect(clientBookingActions({ status, startAt, promotionApplied }, now)).toEqual(expected);
    });
});

test('rescheduleDays are days of the business calendar', () => {
    // 20:00Z is already the next day in Bishkek (UTC+6).
    expect(rescheduleDays('Asia/Bishkek', 2, new Date('2040-01-01T20:00:00Z'))).toEqual(['2040-01-02', '2040-01-03']);
});

test('offers only the same master in the same branch, 30 minutes ahead and not the current start', async () => {
    const rpc = jest.fn().mockResolvedValue({
        data: [
            { staff_id: 's', branch_id: 'b', start_at: '2040-01-01T09:00:00Z', end_at: '2040-01-01T09:30:00Z' },
            { staff_id: 's', branch_id: 'b', start_at: '2040-01-01T06:15:00Z', end_at: '2040-01-01T06:45:00Z' },
            { staff_id: 's', branch_id: 'b', start_at: '2040-01-01T08:00:00Z', end_at: '2040-01-01T08:30:00Z' },
            { staff_id: 'x', branch_id: 'b', start_at: '2040-01-01T10:00:00Z', end_at: '2040-01-01T10:30:00Z' },
            { staff_id: 's', branch_id: 'other', start_at: '2040-01-01T11:00:00Z', end_at: '2040-01-01T11:30:00Z' },
            { staff_id: 's', branch_id: 'b', start_at: '2040-01-01T07:00:00Z', end_at: '2040-01-01T07:30:00Z' },
        ],
        error: null,
    });
    const slots = await loadRescheduleSlots({ rpc }, {
        bizId: 'biz', branchId: 'b', staffId: 's', startAt: '2040-01-01T08:00:00Z', durationMin: 30,
    }, '2040-01-01', now);
    expect(slots.map((slot) => slot.start_at)).toEqual(['2040-01-01T07:00:00Z', '2040-01-01T09:00:00Z']);
    expect(rpc).toHaveBeenCalledWith('get_free_slots_complex_day_v1', expect.objectContaining({
        p_biz_id: 'biz', p_staff_id: 's', p_day: '2040-01-01', p_duration_min: 30, p_branch_id: null,
    }));
});

test('a slots error is raised to the dialog', async () => {
    const rpc = jest.fn().mockResolvedValue({ data: null, error: { message: 'boom' } });
    await expect(loadRescheduleSlots({ rpc }, {
        bizId: 'biz', branchId: 'b', staffId: 's', startAt: '2040-01-01T08:00:00Z', durationMin: 30,
    }, '2040-01-01', now)).rejects.toThrow('boom');
});

describe('postBookingReschedule', () => {
    let map: Map<string, string>;
    let storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
    beforeEach(() => {
        map = new Map();
        storage = {
            getItem: (key: string) => map.get(key) ?? null,
            setItem: (key: string, value: string) => { map.set(key, value); },
            removeItem: (key: string) => { map.delete(key); },
        };
    });

    const respond = (status: number, body: unknown) => jest.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }));
    type Init = RequestInit & { headers: Record<string, string> };

    test('a lost answer is retried with the same key; success ends the attempt', async () => {
        const lost = jest.fn().mockRejectedValue(new Error('network'));
        await expect(postBookingReschedule('b1', '2040-01-01T09:00:00Z', { fetch: lost, storage })).rejects.toThrow('network');
        const firstKey = (lost.mock.calls[0][1] as Init).headers['Idempotency-Key'];
        const ok = respond(200, { ok: true, data: { start_at: '2040-01-01T09:00:00Z', end_at: '2040-01-01T09:30:00Z' } });
        await expect(postBookingReschedule('b1', '2040-01-01T09:00:00Z', { fetch: ok, storage })).resolves.toEqual({
            ok: true, startAt: '2040-01-01T09:00:00Z', endAt: '2040-01-01T09:30:00Z',
        });
        const [url, init] = ok.mock.calls[0] as [string, Init];
        expect(url).toBe('/api/bookings/b1/reschedule');
        expect(init.headers['Idempotency-Key']).toBe(firstKey);
        expect(init.body).toBe(JSON.stringify({ start_at: '2040-01-01T09:00:00Z' }));
        expect(map.size).toBe(0);
    });

    test('a refusal returns the localized server message and ends the attempt', async () => {
        const refused = respond(409, { ok: false, error: 'booking_slot_unavailable', message: 'Это время уже занято. Выберите другое.' });
        await expect(postBookingReschedule('b1', '2040-01-01T09:00:00Z', { fetch: refused, storage })).resolves.toEqual({
            ok: false, error: 'booking_slot_unavailable', message: 'Это время уже занято. Выберите другое.',
        });
        expect(map.size).toBe(0);
    });

    test('an unknown outcome (503) keeps the key for the retry', async () => {
        await postBookingReschedule('b1', '2040-01-01T09:00:00Z', { fetch: respond(503, { ok: false, error: 'service_unavailable' }), storage });
        expect(map.size).toBe(1);
    });
});
