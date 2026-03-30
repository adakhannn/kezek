import { NextResponse } from 'next/server';

import { runQuickHoldHttp } from '@/lib/quickHoldHttpService';

jest.mock('@/lib/requestAuthContext', () => ({
    resolveRequestAuthContext: jest.fn(),
}));

jest.mock('@/lib/validation/apiValidation', () => ({
    validateRequest: jest.fn(),
}));

jest.mock('@/lib/quickHoldService', () => ({
    runQuickHold: jest.fn(),
}));

const { resolveRequestAuthContext } = require('@/lib/requestAuthContext');
const { validateRequest } = require('@/lib/validation/apiValidation');
const { runQuickHold } = require('@/lib/quickHoldService');

describe('quickHoldHttpService', () => {
    const validBody = {
        biz_id: '11111111-1111-4111-8111-111111111111',
        service_id: '33333333-3333-4333-8333-333333333333',
        staff_id: '44444444-4444-4444-8444-444444444444',
        start_at: '2026-03-21T10:00:00Z',
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

    test('returns auth response from auth resolver', async () => {
        resolveRequestAuthContext.mockResolvedValue(
            NextResponse.json({ ok: false, error: 'auth' }, { status: 401 }),
        );

        const res = await runQuickHoldHttp(
            new Request('http://localhost/api/quick-hold', { method: 'POST' }),
        );

        expect(res.status).toBe(401);
    });

    test('creates hold via service orchestration', async () => {
        resolveRequestAuthContext.mockResolvedValue({
            supabase: { mocked: true },
            user: { id: 'user-id-123' },
        });
        validateRequest.mockResolvedValue({
            success: true,
            data: validBody,
        });
        runQuickHold.mockResolvedValue({
            ok: true,
            bookingId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        });

        const res = await runQuickHoldHttp(
            new Request('http://localhost/api/quick-hold', {
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
        expect(runQuickHold).toHaveBeenCalledWith(
            expect.objectContaining({
                userId: 'user-id-123',
                supabase: { mocked: true },
                notify: expect.any(Function),
            }),
            expect.objectContaining(validBody),
        );
    });

    test('maps booking errors to validation response', async () => {
        resolveRequestAuthContext.mockResolvedValue({
            supabase: { mocked: true },
            user: { id: 'user-id-123' },
        });
        validateRequest.mockResolvedValue({
            success: true,
            data: validBody,
        });
        runQuickHold.mockResolvedValue({
            ok: false,
            error: {
                kind: 'NO_ACTIVE_BRANCH_FOR_BIZ',
                message: 'Нет активных филиалов',
            },
        });

        const res = await runQuickHoldHttp(
            new Request('http://localhost/api/quick-hold', {
                method: 'POST',
                body: JSON.stringify(validBody),
                headers: { 'content-type': 'application/json' },
            }),
        );
        const data = await res.json();

        expect(res.status).toBe(400);
        expect(data.error).toBe('validation');
        expect(data.details).toEqual({ kind: 'NO_ACTIVE_BRANCH_FOR_BIZ' });
    });
});
