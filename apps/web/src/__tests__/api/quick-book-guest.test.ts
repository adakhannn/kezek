import { bookingRpcResult } from '../lib/bookingRpcMock';
import { createMockRequest, createMockSupabase, expectErrorResponse, expectSuccessResponse, setupApiTestMocks } from './testHelpers';

setupApiTestMocks();
const { createClient } = require('@supabase/supabase-js');
const { POST } = require('@/app/api/quick-book-guest/route');
const supabase = createMockSupabase();
const requestId = '55555555-5555-4555-8555-555555555555';
const guestSecret = 'a'.repeat(64);
const payload = {
    biz_id: '11111111-1111-4111-8111-111111111111', branch_id: '22222222-2222-4222-8222-222222222222',
    service_id: '33333333-3333-4333-8333-333333333333', staff_id: '44444444-4444-4444-8444-444444444444',
    start_at: '2035-01-01T10:00:00Z', client_name: 'Synthetic Guest', client_phone: '+996555000111',
};
const request = (body: unknown = payload, headers: Record<string, string> = { 'Idempotency-Key': requestId, 'X-Booking-Client-Token': guestSecret }) => createMockRequest('http://localhost/api/quick-book-guest', { method: 'POST', body, headers });

beforeEach(() => {
    jest.clearAllMocks();
    createClient.mockReturnValue(supabase);
    supabase.rpc.mockReturnValue(bookingRpcResult({ data: { booking_id: 'receipt-id', confirmed: true }, error: null }));
    global.fetch = jest.fn(async () => { throw new Error('Unexpected network request'); });
});

test('requires both request identity and proof before creating a booking', async () => {
    for (const headers of [{}, { 'Idempotency-Key': requestId }]) {
        await expectErrorResponse(await POST(request(payload, headers)), 400, 'validation');
    }
    expect(supabase.rpc).not.toHaveBeenCalled();
});

test('validates booking payload before the atomic command', async () => {
    await expectErrorResponse(await POST(request({ biz_id: payload.biz_id })), 400, 'validation');
    expect(supabase.rpc).not.toHaveBeenCalled();
});

test('guest success is one atomic command, no second confirmation/provider request', async () => {
    const response = await expectSuccessResponse(await POST(request()));
    expect(response.data).toEqual({ booking_id: 'receipt-id', confirmed: true });
    expect(supabase.rpc).toHaveBeenCalledTimes(1);
    expect(supabase.rpc).toHaveBeenCalledWith('create_confirmed_booking', {
        p_request_id: requestId, p_payload: expect.objectContaining(payload), p_guest_secret: guestSecret, p_actor_id: null,
    });
    expect(supabase.auth.getUser).not.toHaveBeenCalled();
    expect(supabase.from).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
});

test('normalizes a complex request to one atomic payload', async () => {
    const { service_id, ...base } = payload;
    const services = [{ service_id, duration_min: 30, order_index: 0 }, { service_id, duration_min: 15, order_index: 1 }];
    await expectSuccessResponse(await POST(request({ ...base, services })));
    expect(supabase.rpc).toHaveBeenCalledWith('create_confirmed_booking', expect.objectContaining({ p_payload: expect.objectContaining({ service_id, services }) }));
    expect(supabase.rpc).toHaveBeenCalledTimes(1);
});

test('guest body cannot supply an authenticated actor or client identity', async () => {
    await expectSuccessResponse(await POST(request({ ...payload, p_actor_id: 'foreign', client_id: 'foreign' })));
    const args = supabase.rpc.mock.calls[0][1];
    expect(args.p_actor_id).toBeNull();
    expect(args.p_guest_secret).toBe(guestSecret);
    expect(args.p_payload).not.toHaveProperty('client_id');
    expect(args.p_payload).not.toHaveProperty('p_actor_id');
});

test.each([
    ['BOOKING_REQUEST_CONFLICT', 409, 'booking_request_conflict'],
    ['time slot is already booked', 409, 'booking_slot_unavailable'],
    ['branch not found or inactive', 400, 'validation'],
    ['synthetic outbox failure', 503, 'service_unavailable'],
])('maps atomic command rejection %s without a partial success', async (message, status, code) => {
    supabase.rpc.mockReturnValueOnce(bookingRpcResult({ data: null, error: { message } }));
    await expectErrorResponse(await POST(request()), status as number, code as string);
    expect(supabase.rpc).toHaveBeenCalledTimes(1);
});
