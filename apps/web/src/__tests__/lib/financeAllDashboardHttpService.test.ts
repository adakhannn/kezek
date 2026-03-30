jest.mock('@/lib/financeAllDashboardService', () => ({
    runFinanceAllDashboard: jest.fn(),
}));

jest.mock('@/lib/withManagerContext', () => ({
    withManagerContext: jest.fn(),
}));

import { runFinanceAllDashboard } from '@/lib/financeAllDashboardService';
import { withManagerContext } from '@/lib/withManagerContext';

describe('financeAllDashboardHttpService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (withManagerContext as jest.Mock).mockImplementation(async (_req, _scope, handler) =>
            handler({ supabase: {}, admin: {}, bizId: 'biz-1' }),
        );
    });

    test('maps service failure to error response', async () => {
        (runFinanceAllDashboard as jest.Mock).mockResolvedValue({
            ok: false,
            statusCode: 400,
            errorType: 'validation',
            message: 'bad input',
        });
        const { runFinanceAllDashboardHttp } = await import('@/lib/financeAllDashboardHttpService');

        const response = await runFinanceAllDashboardHttp(
            new Request('http://localhost/api/dashboard/staff/finance/all'),
        );
        const body = await response.json();

        expect(response.status).toBe(400);
        expect(body.error).toBe('validation');
    });

    test('maps service success to success response', async () => {
        (runFinanceAllDashboard as jest.Mock).mockResolvedValue({
            ok: true,
            data: { totalStats: { totalAmount: 100 } },
        });
        const { runFinanceAllDashboardHttp } = await import('@/lib/financeAllDashboardHttpService');

        const response = await runFinanceAllDashboardHttp(
            new Request('http://localhost/api/dashboard/staff/finance/all'),
        );
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.data.totalStats.totalAmount).toBe(100);
    });
});
