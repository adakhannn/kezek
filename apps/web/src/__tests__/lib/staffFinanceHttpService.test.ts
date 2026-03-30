jest.mock('@/lib/staffFinanceRouteService', () => ({
    runStaffFinanceRoute: jest.fn(),
}));

jest.mock('@/lib/apiMetrics', () => ({
    logApiMetric: jest.fn(() => Promise.resolve()),
    getIpAddress: jest.fn(() => '127.0.0.1'),
    determineErrorType: jest.fn(() => null),
}));

import { runStaffFinanceRoute } from '@/lib/staffFinanceRouteService';
import { runStaffFinanceHttp } from '@/lib/staffFinanceHttpService';

describe('staffFinanceHttpService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('maps successful route result to success response', async () => {
        (runStaffFinanceRoute as jest.Mock).mockResolvedValue({
            ok: true,
            data: { today: { exists: false } },
            metric: {
                statusCode: 200,
                staffId: 'staff-1',
                bizId: 'biz-1',
                userId: 'user-1',
                date: null,
                useServiceClient: false,
            },
        });

        const response = await runStaffFinanceHttp(new Request('http://localhost/api/staff/finance'));
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.ok).toBe(true);
    });

    test('maps failed route result to error response', async () => {
        (runStaffFinanceRoute as jest.Mock).mockResolvedValue({
            ok: false,
            status: 404,
            error: 'not_found',
            message: 'missing',
            metric: {
                statusCode: 404,
                staffId: 'staff-1',
                bizId: 'biz-1',
            },
        });

        const response = await runStaffFinanceHttp(new Request('http://localhost/api/staff/finance'));
        const data = await response.json();

        expect(response.status).toBe(404);
        expect(data.ok).toBe(false);
    });

    test('maps thrown auth-like error to 401', async () => {
        (runStaffFinanceRoute as jest.Mock).mockRejectedValue(new Error('UNAUTHORIZED'));

        const response = await runStaffFinanceHttp(new Request('http://localhost/api/staff/finance'));
        const data = await response.json();

        expect(response.status).toBe(401);
        expect(data.ok).toBe(false);
    });
});
