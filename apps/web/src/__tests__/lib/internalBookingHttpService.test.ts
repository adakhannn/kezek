import { NextResponse } from 'next/server';
import { runInternalBookingHttp } from '@/lib/internalBookingHttpService';
import { resolveRequestAuthContext } from '@/lib/requestAuthContext';
import { createInternalBookingRequest } from '@/lib/bookingRequestService';
import { checkRateLimit } from '@/lib/rateLimit';
import { createSupabaseAdminClient } from '@/lib/supabaseHelpers';

jest.mock('@/lib/requestAuthContext', () => ({ resolveRequestAuthContext: jest.fn() }));
jest.mock('@/lib/bookingRequestService', () => ({ createInternalBookingRequest: jest.fn() }));
jest.mock('@/lib/supabaseHelpers', () => ({ createSupabaseAdminClient: jest.fn() }));
jest.mock('@/lib/rateLimit', () => ({ RateLimitConfigs: { normal: { maxRequests: 30 } }, checkRateLimit: jest.fn(),
    rateLimitDeniedResponse: () => new Response(JSON.stringify({ ok: false }), { status: 429 }) }));
const id = (digit: string) => `${digit.repeat(8)}-${digit.repeat(4)}-4${digit.repeat(3)}-8${digit.repeat(3)}-${digit.repeat(12)}`;
const input = { mode: 'simple', biz_id: id('1'), branch_id: id('2'), staff_id: id('3'), service_id: id('4'),
    start_at: '2039-01-01T10:00:00Z', duration_min: 30, client_id: id('5'), client_name: null, client_phone: null };
const request = (body: object = input, key = id('6')) => new Request('http://localhost/api/bookings/internal', { method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key }, body: JSON.stringify(body) });
const admin = { rpc: jest.fn() };
beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(resolveRequestAuthContext).mockResolvedValue({ user: { id: 'verified-actor' } } as never);
    jest.mocked(checkRateLimit).mockResolvedValue({ success: true } as never);
    jest.mocked(createSupabaseAdminClient).mockReturnValue(admin as never);
    jest.mocked(createInternalBookingRequest).mockResolvedValue({ bookingId: 'saved-booking', confirmed: true });
});
test('uses verified actor separately from booking client and charges its own user budget', async () => {
    const response = await runInternalBookingHttp(request());
    expect(await response.json()).toEqual({ ok: true, data: { booking_id: 'saved-booking', confirmed: true } });
    expect(createInternalBookingRequest).toHaveBeenCalledWith(admin, { requestId: id('6') }, input, 'verified-actor');
    expect(checkRateLimit).toHaveBeenCalledWith(expect.any(Request), expect.objectContaining({ identifier: 'verified-actor' }), '/api/bookings/internal');
});
test.each([
    ['forged actor', { ...input, actor_id: 'forged' }, id('6')],
    ['missing key', input, ''],
    ['invalid duration', { ...input, duration_min: 0 }, id('6')],
])('rejects %s before admin access', async (_name, body, key) => {
    expect((await runInternalBookingHttp(request(body as object, key as string))).status).toBe(400);
    expect(createSupabaseAdminClient).not.toHaveBeenCalled(); expect(createInternalBookingRequest).not.toHaveBeenCalled();
});
test('auth and exhausted rate budget fail closed', async () => {
    jest.mocked(resolveRequestAuthContext).mockResolvedValue(NextResponse.json({ ok: false }, { status: 401 }));
    expect((await runInternalBookingHttp(request())).status).toBe(401);
    jest.mocked(resolveRequestAuthContext).mockResolvedValue({ user: { id: 'verified-actor' } } as never);
    jest.mocked(checkRateLimit).mockResolvedValue({ success: false } as never);
    expect((await runInternalBookingHttp(request())).status).toBe(429);
    expect(createSupabaseAdminClient).not.toHaveBeenCalled();
});
test('uncertain command response stays503 without internal retry', async () => {
    jest.mocked(createInternalBookingRequest).mockResolvedValue(NextResponse.json({ ok: false }, { status: 503 }));
    expect((await runInternalBookingHttp(request())).status).toBe(503);
    expect(createInternalBookingRequest).toHaveBeenCalledTimes(1);
});
