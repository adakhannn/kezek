import { bookingRpcResult } from '../lib/bookingRpcMock';
import { createMockRequest, createMockSupabase, expectErrorResponse, expectSuccessResponse, setupApiTestMocks } from './testHelpers';

setupApiTestMocks();
const { createClient } = require('@supabase/supabase-js');
const { createServerClient } = require('@supabase/ssr');
const { POST } = require('@/app/api/quick-hold/route');
const supabase = createMockSupabase();
const admin = createMockSupabase();
const requestId = '55555555-5555-4555-8555-555555555555';
const payload = {
    biz_id: '11111111-1111-4111-8111-111111111111',
    service_id: '33333333-3333-4333-8333-333333333333',
    staff_id: '44444444-4444-4444-8444-444444444444', start_at: '2035-01-01T10:00:00Z',
};
const request = (body: unknown = payload, headers: Record<string, string> = { 'Idempotency-Key': requestId }) => createMockRequest('http://localhost/api/quick-hold', { method: 'POST', body, headers });

beforeEach(() => {
    jest.clearAllMocks();
    createServerClient.mockReturnValue(supabase);
    createClient.mockImplementation((_url: string, _key: string, options: { global?: { headers?: { Authorization?: string } } }) => options?.global?.headers?.Authorization ? supabase : admin);
    supabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'verified-user' } }, error: null });
    admin.rpc.mockReturnValue(bookingRpcResult({ data: { booking_id: 'receipt-id', confirmed: true }, error: null }));
    global.fetch = jest.fn(async () => { throw new Error('Unexpected network request'); });
});

test('requires authentication', async () => {
    supabase.auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: null });
    await expectErrorResponse(await POST(request()), 401, 'auth');
    expect(admin.rpc).not.toHaveBeenCalled();
});

test('requires client request identity and valid payload', async () => {
    await expectErrorResponse(await POST(request(payload, {})), 400, 'validation');
    await expectErrorResponse(await POST(request({ biz_id: payload.biz_id })), 400, 'validation');
    expect(admin.rpc).not.toHaveBeenCalled();
});

test.each(['cookie', 'bearer'])('creates one atomic command using verified %s actor on the service client and no provider dispatch', async mode => {
    const headers = { 'Idempotency-Key': requestId, ...(mode === 'bearer' ? { Authorization: 'Bearer synthetic-token' } : {}) };
    const response = await expectSuccessResponse(await POST(request(payload, headers)));
    expect(response.data).toEqual({ booking_id: 'receipt-id', confirmed: true });
    expect(admin.rpc).toHaveBeenCalledTimes(1);
    expect(admin.rpc).toHaveBeenCalledWith('create_confirmed_booking', {
        p_request_id: requestId, p_payload: expect.objectContaining(payload), p_guest_secret: null, p_actor_id: 'verified-user',
    });
    expect(supabase.rpc).not.toHaveBeenCalled();
    expect(supabase.from).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
});

test('payload identity fields cannot replace the verified actor', async () => {
    await expectSuccessResponse(await POST(request({ ...payload, actor_id: 'foreign', p_actor_id: 'foreign', client_id: 'foreign' })));
    const args = admin.rpc.mock.calls[0][1];
    expect(args.p_actor_id).toBe('verified-user');
    expect(args.p_payload).not.toHaveProperty('client_id');
    expect(args.p_payload).not.toHaveProperty('p_actor_id');
    expect(supabase.rpc).not.toHaveBeenCalled();
});

test.each([
    ['BOOKING_REQUEST_CONFLICT', 409, 'booking_request_conflict'],
    ['time slot is already booked', 409, 'booking_slot_unavailable'],
    ['NO_ACTIVE_BRANCH_FOR_BIZ', 400, 'validation'],
    ['synthetic confirm failure', 503, 'service_unavailable'],
])('maps atomic command rejection %s', async (message, status, code) => {
    admin.rpc.mockReturnValueOnce(bookingRpcResult({ data: null, error: { message } }));
    await expectErrorResponse(await POST(request()), status as number, code as string);
    expect(admin.rpc).toHaveBeenCalledTimes(1);
});
