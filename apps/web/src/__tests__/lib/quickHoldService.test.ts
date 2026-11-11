import { bookingRpcResult } from './bookingRpcMock';
import { NextResponse } from 'next/server';
import { runQuickHold } from '@/lib/quickHoldService';

const input = {
    biz_id: '11111111-1111-4111-8111-111111111111',
    service_id: '33333333-3333-4333-8333-333333333333',
    staff_id: '44444444-4444-4444-8444-444444444444',
    start_at: '2035-01-01T10:00:00Z',
};
const identity = { requestId: '55555555-5555-4555-8555-555555555555' };

test.each([undefined, [{ service_id: input.service_id, duration_min: 30 }]])('creates single/complex booking with one atomic command (%j)', async services => {
    const rpc = jest.fn().mockReturnValue(bookingRpcResult({ data: { booking_id: 'receipt-id', confirmed: true }, error: null }));
    const payload = { ...input, services };
    expect(await runQuickHold({ admin: { rpc }, actorId: 'verified-user', identity }, payload)).toEqual({ bookingId: 'receipt-id', confirmed: true });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('create_confirmed_booking', {
        p_request_id: identity.requestId, p_payload: payload, p_guest_secret: null, p_actor_id: 'verified-user',
    });
});

test('SQL rejection cannot become a successful partial booking', async () => {
    const rpc = jest.fn().mockReturnValue(bookingRpcResult({ data: null, error: { message: 'synthetic confirm failure' } }));
    const response = await runQuickHold({ admin: { rpc }, actorId: 'verified-user', identity }, input);
    expect((response as NextResponse).status).toBe(503);
    expect(rpc).toHaveBeenCalledTimes(1);
});
