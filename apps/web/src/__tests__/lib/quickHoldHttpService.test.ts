import { NextResponse } from 'next/server';
import { runQuickHoldHttp } from '@/lib/quickHoldHttpService';
import { resolveRequestAuthContext } from '@/lib/requestAuthContext';
import { validateRequest } from '@/lib/validation/apiValidation';
import { createSupabaseAdminClient } from '@/lib/supabaseHelpers';
import { runQuickHold } from '@/lib/quickHoldService';

jest.mock('@/lib/requestAuthContext', () => ({ resolveRequestAuthContext: jest.fn() }));
jest.mock('@/lib/validation/apiValidation', () => ({ validateRequest: jest.fn() }));
jest.mock('@/lib/supabaseHelpers', () => ({ createSupabaseAdminClient: jest.fn() }));
jest.mock('@/lib/quickHoldService', () => ({ runQuickHold: jest.fn() }));

const payload = {
    biz_id: '11111111-1111-4111-8111-111111111111',
    service_id: '33333333-3333-4333-8333-333333333333',
    staff_id: '44444444-4444-4444-8444-444444444444', start_at: '2035-01-01T10:00:00Z',
};
const requestId = '55555555-5555-4555-8555-555555555555';
const supabase = { rpc: jest.fn() };
const admin = { rpc: jest.fn() };
const request = (headers: Record<string, string> = { 'Idempotency-Key': requestId }) => new Request('http://localhost/api/quick-hold', { method: 'POST', headers });

beforeEach(() => {
    jest.resetAllMocks();
    jest.mocked(createSupabaseAdminClient).mockReturnValue(admin as never);
    jest.mocked(resolveRequestAuthContext).mockResolvedValue({ supabase, user: { id: 'verified-user' }, authSource: 'cookie' } as never);
    jest.mocked(validateRequest).mockResolvedValue({ success: true, data: payload });
    jest.mocked(runQuickHold).mockResolvedValue({ bookingId: 'receipt-id', confirmed: true });
});

test('auth rejection precedes request identity validation', async () => {
    const denied = NextResponse.json({ ok: false, error: 'auth' }, { status: 401 });
    jest.mocked(resolveRequestAuthContext).mockResolvedValue(denied);
    expect(await runQuickHoldHttp(request({}))).toBe(denied);
    expect(runQuickHold).not.toHaveBeenCalled();
    expect(createSupabaseAdminClient).not.toHaveBeenCalled();
});

test('missing identity fails closed before booking work', async () => {
    expect((await runQuickHoldHttp(request({}))).status).toBe(400);
    expect(runQuickHold).not.toHaveBeenCalled();
    expect(createSupabaseAdminClient).not.toHaveBeenCalled();
});

test('preserves request validator failure', async () => {
    const invalid = NextResponse.json({ ok: false, error: 'validation' }, { status: 400 });
    jest.mocked(validateRequest).mockResolvedValue({ success: false, response: invalid });
    expect(await runQuickHoldHttp(request())).toBe(invalid);
    expect(runQuickHold).not.toHaveBeenCalled();
    expect(createSupabaseAdminClient).not.toHaveBeenCalled();
});

test('uses service client with verified actor, ignores guest proof header, wraps atomic receipt', async () => {
    const response = await runQuickHoldHttp(request({ 'Idempotency-Key': requestId, 'X-Booking-Client-Token': 'a'.repeat(64) }));
    expect(runQuickHold).toHaveBeenCalledWith({ admin, actorId: 'verified-user', identity: { requestId } }, expect.objectContaining(payload));
    expect(await response.json()).toEqual({ ok: true, data: { booking_id: 'receipt-id', confirmed: true } });
});

test('normalizes complex service fallback before the atomic command', async () => {
    const { service_id, ...base } = payload;
    jest.mocked(validateRequest).mockResolvedValue({ success: true, data: { ...base, services: [{ service_id, duration_min: 30 }] } });
    await runQuickHoldHttp(request());
    expect(runQuickHold).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ service_id, services: [{ service_id, duration_min: 30 }] }));
});

test('passes command conflict through without a success envelope', async () => {
    const conflict = NextResponse.json({ ok: false, error: 'booking_request_conflict' }, { status: 409 });
    jest.mocked(runQuickHold).mockResolvedValue(conflict);
    expect(await runQuickHoldHttp(request())).toBe(conflict);
});
