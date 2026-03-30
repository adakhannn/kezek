import { runStaffShiftItemsHttp } from '@/lib/staffShiftItemsHttpService';

jest.mock('@/lib/staffShiftItemsRouteService', () => ({
    runStaffShiftItemsRoute: jest.fn(),
}));

jest.mock('@/lib/apiMetrics', () => ({
    determineErrorType: jest.fn(() => 'internal'),
    getIpAddress: jest.fn(() => '127.0.0.1'),
    logApiMetric: jest.fn(() => Promise.resolve()),
}));

const { runStaffShiftItemsRoute } = require('@/lib/staffShiftItemsRouteService');

describe('staffShiftItemsHttpService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('returns success response when route service succeeds', async () => {
        runStaffShiftItemsRoute.mockResolvedValue({
            ok: true,
            metric: {
                staffId: 'staff-1',
                bizId: 'biz-1',
                userId: 'user-1',
            },
        });

        const res = await runStaffShiftItemsHttp(
            new Request('http://localhost/api/staff/shift/items', { method: 'POST' }),
        );
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.ok).toBe(true);
    });

    test('maps route service failures to standardized error response', async () => {
        runStaffShiftItemsRoute.mockResolvedValue({
            ok: false,
            error: 'validation',
            message: 'Ошибка валидации',
            status: 400,
            metric: {
                staffId: 'staff-1',
                bizId: 'biz-1',
                userId: 'user-1',
            },
        });

        const res = await runStaffShiftItemsHttp(
            new Request('http://localhost/api/staff/shift/items', { method: 'POST' }),
        );
        const data = await res.json();

        expect(res.status).toBe(400);
        expect(data.error).toBe('validation');
        expect(data.message).toBe('Ошибка валидации');
    });

    test('returns internal response on unexpected exception', async () => {
        runStaffShiftItemsRoute.mockRejectedValue(new Error('boom'));

        const res = await runStaffShiftItemsHttp(
            new Request('http://localhost/api/staff/shift/items', { method: 'POST' }),
        );
        const data = await res.json();

        expect(res.status).toBe(500);
        expect(data.error).toBe('internal');
        expect(data.message).toBe('Ошибка при сохранении данных');
    });
});
