/** @jest-environment jsdom */
import { webcrypto } from 'node:crypto';
import { TextEncoder } from 'node:util';
import { postInternalBooking } from '@/lib/internalBookingClient';
import { supabase } from '@/lib/supabaseClient';
import type { InternalBookingInput } from '@/lib/internalBookingSchema';

jest.mock('@/lib/supabaseClient', () => ({ supabase: { auth: { getSession: jest.fn() } } }));
const input: InternalBookingInput = { mode: 'simple', biz_id: 'biz', branch_id: 'branch', staff_id: 'staff', service_id: 'service',
    start_at: '2039-01-01T10:00:00Z', duration_min: 30, client_id: 'client', client_name: 'Synthetic Person', client_phone: '+996555000111' };
const session = (id = 'actor') => ({ data: { session: { user: { id }, access_token: 'synthetic-token' } }, error: null });
const success = () => ({ ok: true, json: async () => ({ ok: true, data: { booking_id: 'receipt-booking', confirmed: true } }) });
beforeAll(() => {
    Object.assign(globalThis, { TextEncoder });
    Object.defineProperty(globalThis, 'crypto', { configurable: true, value: webcrypto });
});
beforeEach(() => {
    sessionStorage.clear();
    jest.mocked(supabase.auth.getSession).mockResolvedValue(session() as never);
    globalThis.fetch = jest.fn();
});

test('network uncertainty preserves identity across the next call and storage contains no contact/token', async () => {
    jest.mocked(fetch).mockRejectedValueOnce(new Error('Lost response')).mockResolvedValueOnce(success() as Response);
    await expect(postInternalBooking(input)).rejects.toThrow('Lost response');
    const first = jest.mocked(fetch).mock.calls[0][1]!;
    const persisted = sessionStorage.getItem(sessionStorage.key(0)!)!;
    expect(persisted).not.toContain(input.client_phone!); expect(persisted).not.toContain('synthetic-token');
    expect(persisted).not.toContain(input.client_name!);
    await expect(postInternalBooking({ ...input })).resolves.toBe('receipt-booking');
    expect(jest.mocked(fetch).mock.calls[1][1]!.headers).toEqual(first.headers);
    expect(JSON.parse(first.body as string).client_id).toBe('client');
    expect(sessionStorage.length).toBe(0);
});

test('concurrent clicks share one persisted key; changing actor starts a distinct attempt', async () => {
    jest.mocked(fetch).mockResolvedValue({ ok: false, json: async () => ({ ok: false }) } as Response);
    await Promise.allSettled(Array.from({ length: 8 }, () => postInternalBooking(input)));
    const keys = jest.mocked(fetch).mock.calls.map(([, options]) => (options!.headers as Record<string, string>)['Idempotency-Key']);
    expect(new Set(keys).size).toBe(1);
    jest.mocked(supabase.auth.getSession).mockResolvedValue(session('other-actor') as never);
    await expect(postInternalBooking(input)).rejects.toThrow();
    const last = jest.mocked(fetch).mock.calls.at(-1)![1]!.headers as Record<string, string>;
    expect(last['Idempotency-Key']).not.toBe(keys[0]);
});

test('unconfirmed success retains identity; no session prevents POST', async () => {
    jest.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({ ok: true, data: { booking_id: 'unconfirmed' } }) } as Response);
    await expect(postInternalBooking(input)).rejects.toThrow('не подтверждён');
    expect(sessionStorage.length).toBe(1);
    jest.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: null }, error: null });
    await expect(postInternalBooking(input)).rejects.toThrow('Войдите');
    expect(fetch).toHaveBeenCalledTimes(1);
});
