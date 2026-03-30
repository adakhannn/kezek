import { NextResponse } from 'next/server';

import { runQuickBookGuestHttp } from '@/lib/quickBookGuestHttpService';

jest.mock('@/lib/validation/apiValidation', () => ({
    validateRequest: jest.fn(),
}));

jest.mock('@/lib/supabaseHelpers', () => ({
    createSupabaseAnonClient: jest.fn(),
}));

jest.mock('@/lib/quickBookGuestService', () => ({
    runQuickBookGuest: jest.fn(),
}));

const { validateRequest } = require('@/lib/validation/apiValidation');
const { createSupabaseAnonClient } = require('@/lib/supabaseHelpers');
const { runQuickBookGuest } = require('@/lib/quickBookGuestService');

describe('quickBookGuestHttpService', () => {
    const validBody = {
        biz_id: '11111111-1111-4111-8111-111111111111',
        branch_id: '22222222-2222-4222-8222-222222222222',
        service_id: '33333333-3333-4333-8333-333333333333',
        staff_id: '44444444-4444-4444-8444-444444444444',
        start_at: '2026-03-21T10:00:00Z',
        client_name: 'Test User',
        client_phone: '+996555123456',
        client_email: 'test@example.com',
    };

    beforeEach(() => {
        jest.clearAllMocks();
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: jest.fn().mockResolvedValue({ ok: true }),
            text: jest.fn().mockResolvedValue(''),
        } as unknown as Response);
    });

    test('returns validation response from request validator', async () => {
        validateRequest.mockResolvedValue({
            success: false,
            response: NextResponse.json(
                { ok: false, error: 'validation' },
                { status: 400 },
            ),
        });

        const res = await runQuickBookGuestHttp(
            new Request('http://localhost/api/quick-book-guest', {
                method: 'POST',
            }),
        );

        expect(res.status).toBe(400);
    });

    test('creates guest booking and returns success payload', async () => {
        validateRequest.mockResolvedValue({
            success: true,
            data: validBody,
        });
        createSupabaseAnonClient.mockReturnValue({ mocked: true });
        runQuickBookGuest.mockResolvedValue({
            bookingId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            confirmed: true,
        });

        const res = await runQuickBookGuestHttp(
            new Request('http://localhost/api/quick-book-guest', {
                method: 'POST',
                body: JSON.stringify(validBody),
                headers: { 'content-type': 'application/json' },
            }),
        );
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.data).toEqual({
            booking_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            confirmed: true,
        });
        expect(runQuickBookGuest).toHaveBeenCalledWith(
            expect.objectContaining({
                supabase: { mocked: true },
                notifyGuestBooking: expect.any(Function),
            }),
            expect.objectContaining(validBody),
        );
    });

    test('returns next response from guest booking service as-is', async () => {
        validateRequest.mockResolvedValue({
            success: true,
            data: validBody,
        });
        createSupabaseAnonClient.mockReturnValue({ mocked: true });
        runQuickBookGuest.mockResolvedValue(
            NextResponse.json({ ok: false, error: 'validation' }, { status: 400 }),
        );

        const res = await runQuickBookGuestHttp(
            new Request('http://localhost/api/quick-book-guest', {
                method: 'POST',
                body: JSON.stringify(validBody),
                headers: { 'content-type': 'application/json' },
            }),
        );

        expect(res.status).toBe(400);
    });
});
