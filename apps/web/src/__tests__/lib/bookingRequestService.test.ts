import { bookingRpcResult, bookingRpcFailure } from './bookingRpcMock';
import { NextResponse } from 'next/server';

import { readBookingRequestIdentity } from '@/lib/bookingRequestHttp';
import { createConfirmedBooking, createInternalBookingRequest } from '@/lib/bookingRequestService';

const requestId = '11111111-1111-4111-8111-111111111111';
const guestSecret = 'a'.repeat(64);

test('missing, malformed or missing guest proof fail before a command can be issued', () => {
    for (const headers of [{}, { 'Idempotency-Key': 'new-key' }, { 'Idempotency-Key': requestId }]) {
        const response = readBookingRequestIdentity(new Request('http://localhost', { headers }), true);
        expect(response).toBeInstanceOf(NextResponse);
        expect((response as NextResponse).status).toBe(400);
    }
});

test('authenticated command cannot adopt a guest identity from a caller header', () => {
    expect(readBookingRequestIdentity(new Request('http://localhost', { headers: {
        'Idempotency-Key': requestId, 'X-Booking-Client-Token': guestSecret,
    } }), false)).toEqual({ requestId });
});

test('one atomic RPC receives caller identity and returns the committed receipt', async () => {
    const rpc = jest.fn().mockReturnValue(bookingRpcResult({ data: { booking_id: 'receipt-id', confirmed: true }, error: null }));
    const input = { biz_id: 'test-biz' };
    expect(await createConfirmedBooking({ rpc }, { requestId, guestSecret }, input, null)).toEqual({ bookingId: 'receipt-id', confirmed: true });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('create_confirmed_booking', {
        p_request_id: requestId, p_payload: input, p_guest_secret: guestSecret, p_actor_id: null,
    });
});

test.each([
    ['BOOKING_REQUEST_CONFLICT', undefined, 409, 'booking_request_conflict'],
    ['time slot is already booked', undefined, 409, 'booking_slot_unavailable'],
    ['exclusion violation', '23P01', 409, 'booking_slot_unavailable'],
    ['BOOKING_AUTH_REQUIRED', undefined, 401, 'auth'],
    ['BOOKING_FORBIDDEN', undefined, 403, 'forbidden'],
    ['client no longer exists', '23503', 400, 'validation'],
    ['SCHEDULE_OUTSIDE_WORKING_HOURS', undefined, 400, 'validation'],
    ['invalid uuid contains private value', '22P02', 400, 'validation'],
    ['outbox unavailable with private payload', 'XX000', 503, 'service_unavailable'],
])('maps %s without exposing raw SQL/error details', async (message, code, status, error) => {
    const rpc = jest.fn().mockReturnValue(bookingRpcResult({ data: null, error: { message, code, details: guestSecret } }));
    const response = await createConfirmedBooking({ rpc }, { requestId }, {}, 'verified-user');
    expect(response).toBeInstanceOf(NextResponse);
    expect((response as NextResponse).status).toBe(status);
    const body = await (response as NextResponse).json();
    expect(body.error).toBe(error);
    expect(JSON.stringify(body)).not.toContain(guestSecret);
    expect(JSON.stringify(body)).not.toContain('private');
});

test('internal RPC binds verified actor separately from the requested client and never passes guest proof', async () => {
    const rpc = jest.fn().mockReturnValue(bookingRpcResult({ data: { booking_id: 'internal-id', confirmed: true }, error: null }));
    const input = { client_id: 'booking-client' };
    expect(await createInternalBookingRequest({ rpc }, { requestId }, input, 'verified-staff')).toEqual({ bookingId: 'internal-id', confirmed: true });
    expect(rpc).toHaveBeenCalledWith('create_internal_booking_request', { p_request_id: requestId, p_payload: input, p_actor_id: 'verified-staff' });
});

test.each([null, 'booking-id', { booking_id: 'id', confirmed: false }, { confirmed: true }])('rejects an incomplete command receipt (%j)', async data => {
    const rpc = jest.fn().mockReturnValue(bookingRpcResult({ data, error: null }));
    const response = await createConfirmedBooking({ rpc }, { requestId }, {}, 'verified-user');
    expect((response as NextResponse).status).toBe(503);
});

test('transport loss after a possible commit is an uncertain retryable result, with no leaked proof', async () => {
    const rpc = jest.fn().mockReturnValue(bookingRpcFailure(new Error(`Transport lost: ${guestSecret}`)));
    const response = await createConfirmedBooking({ rpc }, { requestId, guestSecret }, {}, null);
    expect((response as NextResponse).status).toBe(503);
    const body = await (response as NextResponse).json();
    expect(body.error).toBe('service_unavailable');
    expect(JSON.stringify(body)).not.toContain(guestSecret);
    expect(rpc).toHaveBeenCalledTimes(1);
});

test('hung RPC is aborted at the deadline, returns uncertain 503 and is never retried internally', async () => {
    jest.useFakeTimers();
    let signal: AbortSignal | undefined;
    const rpc = jest.fn(() => ({ abortSignal: (value: AbortSignal) => {
        signal = value;
        return new Promise<never>(() => {});
    } }));
    try {
        const pending = createConfirmedBooking({ rpc }, { requestId, guestSecret }, {}, null);
        await jest.advanceTimersByTimeAsync(9999);
        expect(signal?.aborted).toBe(false);
        await jest.advanceTimersByTimeAsync(1);
        const response = await pending as NextResponse;
        expect(signal?.aborted).toBe(true);
        expect(response.status).toBe(503);
        expect(await response.json()).toMatchObject({ error: 'service_unavailable' });
        expect(rpc).toHaveBeenCalledTimes(1);
        expect(rpc.mock.calls[0]).toEqual(['create_confirmed_booking', expect.objectContaining({
            p_request_id: requestId, p_guest_secret: guestSecret, p_actor_id: null,
        })]);
    } finally { jest.useRealTimers(); }
});
