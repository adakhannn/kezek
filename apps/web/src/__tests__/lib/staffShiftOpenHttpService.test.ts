import { runStaffShiftOpenHttp } from '@/lib/staffShiftOpenHttpService';

jest.mock('@/lib/authBiz', () => ({
    getStaffContext: jest.fn(),
}));

jest.mock('@/lib/staffShiftOpenService', () => ({
    runOpenStaffShift: jest.fn(),
}));

jest.mock('@/lib/apiMetrics', () => ({
    determineErrorType: jest.fn(() => 'internal'),
    getIpAddress: jest.fn(() => '127.0.0.1'),
    logApiMetric: jest.fn(() => Promise.resolve()),
}));

const { getStaffContext } = require('@/lib/authBiz');
const { runOpenStaffShift } = require('@/lib/staffShiftOpenService');

describe('staffShiftOpenHttpService', () => {
    const supabase = {
        auth: {
            getUser: jest.fn(),
        },
    };

    beforeEach(() => {
        jest.clearAllMocks();
        supabase.auth.getUser.mockResolvedValue({
            data: { user: { id: 'user-id' } },
        });
    });

    test('returns success payload from open shift service', async () => {
        getStaffContext.mockResolvedValue({
            supabase,
            staffId: 'staff-id',
            bizId: 'biz-id',
            branchId: 'branch-id',
        });
        runOpenStaffShift.mockResolvedValue({
            ok: true,
            status: 200,
            shift: { id: 'shift-id', status: 'open' },
        });

        const res = await runStaffShiftOpenHttp(
            new Request('http://localhost/api/staff/shift/open', { method: 'POST' }),
        );
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.data.shift).toEqual({ id: 'shift-id', status: 'open' });
    });

    test('maps service failure to api error response', async () => {
        getStaffContext.mockResolvedValue({
            supabase,
            staffId: 'staff-id',
            bizId: 'biz-id',
            branchId: 'branch-id',
        });
        runOpenStaffShift.mockResolvedValue({
            ok: false,
            status: 400,
            error: 'validation',
            message: 'Сегодня выходной',
        });

        const res = await runStaffShiftOpenHttp(
            new Request('http://localhost/api/staff/shift/open', { method: 'POST' }),
        );
        const data = await res.json();

        expect(res.status).toBe(400);
        expect(data.error).toBe('validation');
        expect(data.message).toBe('Сегодня выходной');
    });

    test('returns internal response on unexpected exception', async () => {
        getStaffContext.mockRejectedValue(new Error('boom'));

        const res = await runStaffShiftOpenHttp(
            new Request('http://localhost/api/staff/shift/open', { method: 'POST' }),
        );
        const data = await res.json();

        expect(res.status).toBe(500);
        expect(data.error).toBe('internal');
        expect(data.message).toBe('boom');
    });
});
