import { NextResponse } from 'next/server';
import { runQuickBookGuestHttp } from '@/lib/quickBookGuestHttpService';
import { validateRequest } from '@/lib/validation/apiValidation';
import { createSupabaseAdminClient } from '@/lib/supabaseHelpers';
import { runQuickBookGuest } from '@/lib/quickBookGuestService';

jest.mock('@/lib/validation/apiValidation', () => ({ validateRequest: jest.fn() }));
jest.mock('@/lib/supabaseHelpers', () => ({ createSupabaseAdminClient: jest.fn() }));
jest.mock('@/lib/quickBookGuestService', () => ({ runQuickBookGuest: jest.fn() }));

const payload = {
    biz_id: '11111111-1111-4111-8111-111111111111', branch_id: '22222222-2222-4222-8222-222222222222',
    service_id: '33333333-3333-4333-8333-333333333333', staff_id: '44444444-4444-4444-8444-444444444444',
    start_at: '2035-01-01T10:00:00Z', client_name: 'Synthetic Guest', client_phone: '+996555000111',
};
const requestId = '55555555-5555-4555-8555-555555555555';
const guestSecret = 'a'.repeat(64);
const supabase = { rpc: jest.fn() };
const request = (headers: Record<string, string> = { 'Idempotency-Key': requestId, 'X-Booking-Client-Token': guestSecret }) => new Request('http://localhost/api/quick-book-guest', { method: 'POST', headers });

beforeEach(() => {
    jest.resetAllMocks();
    jest.mocked(createSupabaseAdminClient).mockReturnValue(supabase as never);
    jest.mocked(validateRequest).mockResolvedValue({ success: true, data: payload });
    jest.mocked(runQuickBookGuest).mockResolvedValue({ bookingId: 'receipt-id', confirmed: true });
});

test.each([{}, { 'Idempotency-Key': requestId }])('missing request identity/proof fails before booking work (%j)', async headers => {
    expect((await runQuickBookGuestHttp(request(headers))).status).toBe(400);
    expect(runQuickBookGuest).not.toHaveBeenCalled();
    expect(createSupabaseAdminClient).not.toHaveBeenCalled();
});

test('preserves request validator failure', async () => {
    const invalid = NextResponse.json({ ok: false, error: 'validation' }, { status: 400 });
    jest.mocked(validateRequest).mockResolvedValue({ success: false, response: invalid });
    expect(await runQuickBookGuestHttp(request())).toBe(invalid);
    expect(runQuickBookGuest).not.toHaveBeenCalled();
    expect(createSupabaseAdminClient).not.toHaveBeenCalled();
});

test('forwards guest identity on a service-only client and wraps only the atomic receipt', async () => {
    const response = await runQuickBookGuestHttp(request());
    expect(runQuickBookGuest).toHaveBeenCalledWith({ admin: supabase, identity: { requestId, guestSecret } }, expect.objectContaining(payload));
    expect(await response.json()).toEqual({ ok: true, data: { booking_id: 'receipt-id', confirmed: true } });
});

test('normalizes complex service fallback', async () => {
    const { service_id, ...base } = payload;
    jest.mocked(validateRequest).mockResolvedValue({ success: true, data: { ...base, services: [{ service_id, duration_min: 30 }] } });
    await runQuickBookGuestHttp(request());
    expect(runQuickBookGuest).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ service_id, services: [{ service_id, duration_min: 30 }] }));
});

test('preserves unavailable atomic result rather than returning a partial booking id', async () => {
    const unavailable = NextResponse.json({ ok: false, error: 'service_unavailable' }, { status: 503 });
    jest.mocked(runQuickBookGuest).mockResolvedValue(unavailable);
    expect(await runQuickBookGuestHttp(request())).toBe(unavailable);
});
