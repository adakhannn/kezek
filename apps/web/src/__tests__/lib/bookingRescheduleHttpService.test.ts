import { NextResponse } from 'next/server';

import { runBookingRescheduleHttp } from '@/lib/bookingRescheduleHttpService';
import { rescheduleBooking } from '@/lib/bookingRescheduleService';
import { resolveRequestAuthContext } from '@/lib/requestAuthContext';
import { createSupabaseAdminClient } from '@/lib/supabaseHelpers';

jest.mock('@/lib/requestAuthContext', () => ({ resolveRequestAuthContext: jest.fn() }));
jest.mock('@/lib/supabaseHelpers', () => ({ createSupabaseAdminClient: jest.fn() }));
jest.mock('@/lib/bookingRescheduleService', () => ({ rescheduleBooking: jest.fn() }));

const bookingId = '11111111-1111-4111-8111-111111111111';
const requestId = '55555555-5555-4555-8555-555555555555';
const admin = { rpc: jest.fn() };
const context = { params: Promise.resolve({ id: bookingId }) };
const request = (body: unknown = { start_at: '2040-01-01T12:00:00Z' }, headers: Record<string, string> = { 'Idempotency-Key': requestId }) =>
    new Request(`http://localhost/api/bookings/${bookingId}/reschedule`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body),
    });

beforeEach(() => {
    jest.resetAllMocks();
    jest.mocked(createSupabaseAdminClient).mockReturnValue(admin as never);
    jest.mocked(resolveRequestAuthContext).mockResolvedValue({ supabase: {}, user: { id: 'verified-user' }, authSource: 'bearer' } as never);
    jest.mocked(rescheduleBooking).mockResolvedValue({ bookingId, startAt: '2040-01-01T12:00:00+00:00', endAt: '2040-01-01T12:30:00+00:00' });
});

test('an unauthenticated caller is refused before any work', async () => {
    const denied = NextResponse.json({ ok: false, error: 'auth' }, { status: 401 });
    jest.mocked(resolveRequestAuthContext).mockResolvedValue(denied);
    expect(await runBookingRescheduleHttp(request(), context)).toBe(denied);
    expect(rescheduleBooking).not.toHaveBeenCalled();
});

test('the Idempotency-Key is mandatory', async () => {
    expect((await runBookingRescheduleHttp(request(undefined, {}), context)).status).toBe(400);
    expect(rescheduleBooking).not.toHaveBeenCalled();
});

test.each([[{}], [{ start_at: 'tomorrow' }], [{ start_at: 1234 }]])('rejects an invalid body %o', async (body) => {
    expect((await runBookingRescheduleHttp(request(body), context)).status).toBe(400);
    expect(rescheduleBooking).not.toHaveBeenCalled();
});

test('moves the booking as the verified actor through the service client', async () => {
    const response = await runBookingRescheduleHttp(request(), context);
    expect(rescheduleBooking).toHaveBeenCalledWith(admin, { requestId }, { bookingId, startAt: '2040-01-01T12:00:00Z' }, 'verified-user');
    expect(await response.json()).toEqual({
        ok: true,
        data: { booking_id: bookingId, start_at: '2040-01-01T12:00:00+00:00', end_at: '2040-01-01T12:30:00+00:00', rescheduled: true },
    });
});

test('passes a command refusal through unchanged', async () => {
    const refused = NextResponse.json({ ok: false, error: 'booking_already_started' }, { status: 409 });
    jest.mocked(rescheduleBooking).mockResolvedValue(refused);
    expect(await runBookingRescheduleHttp(request(), context)).toBe(refused);
});
