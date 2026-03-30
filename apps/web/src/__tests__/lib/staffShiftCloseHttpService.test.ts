import { NextResponse } from 'next/server';

import { runStaffShiftCloseHttp } from '@/lib/staffShiftCloseHttpService';

jest.mock('@/lib/authBiz', () => ({
    getStaffContext: jest.fn(),
}));

jest.mock('@/lib/validation/apiValidation', () => ({
    validateRequest: jest.fn(),
}));

jest.mock('@/lib/staffShiftCloseService', () => ({
    runStaffShiftClose: jest.fn(),
}));

jest.mock('@/lib/apiMetrics', () => ({
    determineErrorType: jest.fn(() => 'internal'),
    getIpAddress: jest.fn(() => '127.0.0.1'),
    logApiMetric: jest.fn(() => Promise.resolve()),
}));

const { getStaffContext } = require('@/lib/authBiz');
const { validateRequest } = require('@/lib/validation/apiValidation');
const { runStaffShiftClose } = require('@/lib/staffShiftCloseService');

describe('staffShiftCloseHttpService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('returns validation error response from request validation', async () => {
        getStaffContext.mockResolvedValue({
            supabase: { mocked: true },
            userId: 'user-id',
            staffId: 'staff-id',
            bizId: 'biz-id',
        });
        validateRequest.mockResolvedValue({
            success: false,
            response: NextResponse.json(
                {
                    ok: false,
                    error: 'validation',
                    errors: [{ path: 'totalAmount', message: 'Required' }],
                },
                { status: 400 },
            ),
        });

        const res = await runStaffShiftCloseHttp(
            new Request('http://localhost/api/staff/shift/close', { method: 'POST' }),
        );
        const data = await res.json();

        expect(res.status).toBe(400);
        expect(data.error).toBe('validation');
        expect(data.message).toContain('totalAmount');
    });

    test('returns success payload from shift close service', async () => {
        getStaffContext.mockResolvedValue({
            supabase: { mocked: true },
            userId: 'user-id',
            staffId: 'staff-id',
            bizId: 'biz-id',
        });
        validateRequest.mockResolvedValue({
            success: true,
            data: {
                totalAmount: 1500,
                consumablesAmount: 100,
                items: [{ serviceAmount: 1400 }],
            },
        });
        runStaffShiftClose.mockResolvedValue({
            ok: true,
            shift: {
                id: 'shift-id',
                status: 'closed',
            },
        });

        const res = await runStaffShiftCloseHttp(
            new Request('http://localhost/api/staff/shift/close', {
                method: 'POST',
                body: JSON.stringify({ totalAmount: 1500 }),
                headers: { 'content-type': 'application/json' },
            }),
        );
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.data.shift).toEqual({
            id: 'shift-id',
            status: 'closed',
        });
        expect(runStaffShiftClose).toHaveBeenCalledWith({
            supabase: { mocked: true },
            staffId: 'staff-id',
            bizId: 'biz-id',
            items: [{ serviceAmount: 1400 }],
            totalAmountRaw: 1500,
            consumablesAmount: 100,
        });
    });

    test('returns internal error on unexpected exception', async () => {
        getStaffContext.mockRejectedValue(new Error('boom'));

        const res = await runStaffShiftCloseHttp(
            new Request('http://localhost/api/staff/shift/close', { method: 'POST' }),
        );
        const data = await res.json();

        expect(res.status).toBe(500);
        expect(data.error).toBe('internal');
        expect(data.message).toBe('boom');
    });
});
