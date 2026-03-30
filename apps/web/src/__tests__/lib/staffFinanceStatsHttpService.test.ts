import { runStaffFinanceStatsHttp } from '@/lib/staffFinanceStatsHttpService';

jest.mock('@/lib/withManagerAndStaffContext', () => ({
    withManagerAndStaffContext: jest.fn(),
}));

jest.mock('@/lib/staffFinanceStatsService', () => ({
    runStaffFinanceStats: jest.fn(),
}));

import { runStaffFinanceStats } from '@/lib/staffFinanceStatsService';
import { withManagerAndStaffContext } from '@/lib/withManagerAndStaffContext';

describe('staffFinanceStatsHttpService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('delegates through manager/staff context and returns success response', async () => {
        (withManagerAndStaffContext as jest.Mock).mockImplementation(
            async (_req, _context, _options, handler) =>
                handler({
                    admin: { from: jest.fn() },
                    bizId: 'biz-1',
                    staffId: 'staff-1',
                    staff: { id: 'staff-1', biz_id: 'biz-1', full_name: 'Ada' },
                }),
        );
        (runStaffFinanceStats as jest.Mock).mockResolvedValue({
            ok: true,
            stats: { shiftsCount: 1 },
        });

        const response = await runStaffFinanceStatsHttp(
            new Request('http://localhost/api/dashboard/staff/staff-1/finance/stats'),
            { params: { id: 'staff-1' } },
        );
        const body = await response.json();

        expect(runStaffFinanceStats).toHaveBeenCalledWith({
            req: expect.any(Request),
            admin: { from: expect.any(Function) },
            bizId: 'biz-1',
            staffId: 'staff-1',
            staff: { id: 'staff-1', biz_id: 'biz-1', full_name: 'Ada' },
        });
        expect(response.status).toBe(200);
        expect(body.data.stats).toEqual({ shiftsCount: 1 });
    });

    test('maps service validation errors to api response', async () => {
        (withManagerAndStaffContext as jest.Mock).mockImplementation(
            async (_req, _context, _options, handler) =>
                handler({
                    admin: { from: jest.fn() },
                    bizId: 'biz-1',
                    staffId: 'staff-1',
                    staff: { id: 'staff-1', biz_id: 'biz-1', full_name: 'Ada' },
                }),
        );
        (runStaffFinanceStats as jest.Mock).mockResolvedValue({
            ok: false,
            status: 400,
            error: 'validation',
            message: 'bad period',
        });

        const response = await runStaffFinanceStatsHttp(
            new Request('http://localhost/api/dashboard/staff/staff-1/finance/stats'),
            { params: { id: 'staff-1' } },
        );
        const body = await response.json();

        expect(response.status).toBe(400);
        expect(body.error).toBe('validation');
    });
});
