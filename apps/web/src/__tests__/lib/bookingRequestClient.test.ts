/** @jest-environment jsdom */
import { webcrypto } from 'node:crypto';
import { TextEncoder } from 'node:util';

import { acknowledgeBookingRequest, getBookingRequestHeaders } from '@/lib/bookingRequestClient';
import { createGuestBookingRequest } from '@/lib/quickBookGuestClient';
import { createQuickHoldBooking } from '@/lib/quickHoldClient';

const crypto = webcrypto as unknown as Crypto;
const payload = {
    biz_id: '11111111-1111-4111-8111-111111111111',
    branch_id: '22222222-2222-4222-8222-222222222222',
    service_id: '33333333-3333-4333-8333-333333333333',
    staff_id: '44444444-4444-4444-8444-444444444444',
    start_at: '2026-11-10T10:00:00Z',
    client_name: 'Synthetic Person', client_phone: '+996555000111',
};

beforeAll(() => { Object.assign(globalThis, { TextEncoder }); });
beforeEach(() => { sessionStorage.clear(); });

test('concurrent calls and reloads retain one UUID/proof; no contact data is persisted', async () => {
    const call = () => getBookingRequestHeaders(payload, true, { crypto });
    const headers = await Promise.all(Array.from({ length: 8 }, call));
    headers.forEach(value => expect(value).toEqual(headers[0]));
    expect(headers[0]['Idempotency-Key']).toMatch(/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
    expect(headers[0]['X-Booking-Client-Token']).toMatch(/^[a-f0-9]{64}$/);
    expect(await getBookingRequestHeaders({ ...payload }, true, { crypto })).toEqual(headers[0]);
    const stored = sessionStorage.getItem(sessionStorage.key(0)!);
    expect(stored).not.toContain(payload.client_name);
    expect(stored).not.toContain(payload.client_phone);
    expect(await getBookingRequestHeaders({ ...payload, start_at: '2026-11-10T11:00:00Z' }, true, { crypto })).not.toEqual(headers[0]);
});

test.each([true, false])('lost network response retries with same persisted identity (guest=%s)', async guest => {
    const headers: unknown[] = [];
    const fetchImpl = jest.fn(async (_url, init) => {
        headers.push(init.headers);
        if (headers.length === 1) throw new TypeError('Network response lost');
        return { ok: true, status: 200, json: async () => ({ ok: true, data: { booking_id: 'same-booking', confirmed: true } }) };
    }) as unknown as typeof fetch;
    const requestHeaders = (input: object, isGuest: boolean) => getBookingRequestHeaders(input, isGuest, { crypto });
    const request = guest ? createGuestBookingRequest : createQuickHoldBooking;
    await expect(request(payload, { fetchImpl, requestHeaders })).rejects.toThrow('Network response lost');
    await expect(request(payload, { fetchImpl, requestHeaders })).resolves.toEqual({ bookingId: 'same-booking' });
    expect(headers[1]).toEqual(headers[0]);
});

test('storage failure prevents POST instead of losing retry identity', async () => {
    const fetchImpl = jest.fn();
    const storage = { getItem: () => null, setItem: () => { throw new Error('Storage unavailable'); } };
    await expect(createGuestBookingRequest(payload, {
        fetchImpl,
        requestHeaders: (input, guest) => getBookingRequestHeaders(input, guest, { crypto, storage }),
    })).rejects.toThrow('Storage unavailable');
    expect(fetchImpl).not.toHaveBeenCalled();
});

test('acknowledged success starts a fresh deliberate attempt; stale acknowledgements cannot delete it', async () => {
    const first = await getBookingRequestHeaders(payload, true, { crypto });
    await acknowledgeBookingRequest(payload, true, first, { crypto });
    const next = await getBookingRequestHeaders(payload, true, { crypto });
    expect(next).not.toEqual(first);
    await acknowledgeBookingRequest(payload, true, first, { crypto });
    expect(await getBookingRequestHeaders(payload, true, { crypto })).toEqual(next);
});

test('known success stays successful even if local acknowledgement storage fails', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
        ok: true, status: 200, json: async () => ({ ok: true, data: { booking_id: 'confirmed-id', confirmed: true } }),
    });
    await expect(createGuestBookingRequest(payload, {
        fetchImpl,
        requestHeaders: (input, guest) => getBookingRequestHeaders(input, guest, { crypto }),
        acknowledgeRequest: async () => { throw new Error('Storage unavailable'); },
    })).resolves.toEqual({ bookingId: 'confirmed-id' });
});

test.each([true, false])('unconfirmed/malformed success cannot navigate; retry preserves identity (guest=%s)', async guest => {
    const fetchImpl = jest.fn().mockResolvedValue({
        ok: true, status: 200, json: async () => ({ ok: true, data: { booking_id: 'hold-only', confirmed: false } }),
    });
    const requestHeaders = (input: object, isGuest: boolean) => getBookingRequestHeaders(input, isGuest, { crypto });
    const request = guest ? createGuestBookingRequest : createQuickHoldBooking;
    await expect(request(payload, { fetchImpl, requestHeaders })).rejects.toThrow('Booking confirmation is unavailable');
    const original = fetchImpl.mock.calls[0][1].headers;
    await expect(request(payload, { fetchImpl, requestHeaders })).rejects.toThrow('Booking confirmation is unavailable');
    expect(fetchImpl.mock.calls[1][1].headers).toEqual(original);
});
