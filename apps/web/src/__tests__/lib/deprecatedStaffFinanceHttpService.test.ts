import { runDeprecatedStaffFinanceHttp } from '@/lib/deprecatedStaffFinanceHttpService';

jest.mock('@/lib/log', () => ({
    logWarn: jest.fn(),
}));

jest.mock('@/lib/deprecatedStaffFinanceService', () => ({
    runDeprecatedStaffFinance: jest.fn(),
}));

jest.mock('@/lib/withManagerAndStaffContext', () => ({
    withManagerAndStaffContext: jest.fn(),
}));

import { runDeprecatedStaffFinance } from '@/lib/deprecatedStaffFinanceService';
import { logWarn } from '@/lib/log';
import { withManagerAndStaffContext } from '@/lib/withManagerAndStaffContext';

describe('deprecatedStaffFinanceHttpService', () => {
    const req = new Request('http://localhost/api/dashboard/staff/staff-1/finance?date=2024-01-15');
    const context = { params: { id: 'staff-1' } };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('logs deprecation and maps successful response', async () => {
        (withManagerAndStaffContext as jest.Mock).mockImplementation(
            async (_req, _context, _options, callback) =>
                callback({
                    supabase: { from: jest.fn() },
                    admin: { from: jest.fn() },
                    bizId: 'biz-1',
                    staffId: 'staff-1',
                    staff: {
                        id: 'staff-1',
                        biz_id: 'biz-1',
                        percent_master: 60,
                        percent_salon: 40,
                        hourly_rate: 500,
                    },
                }),
        );
        (runDeprecatedStaffFinance as jest.Mock).mockResolvedValue({
            ok: true,
            data: { today: { exists: false } },
        });

        const response = await runDeprecatedStaffFinanceHttp(req, context);
        const body = await response.json();

        expect(logWarn).toHaveBeenCalled();
        expect(runDeprecatedStaffFinance).toHaveBeenCalled();
        expect(response.status).toBe(200);
        expect(body.data).toEqual({ today: { exists: false } });
    });

    test('maps legacy service error to error response', async () => {
        (withManagerAndStaffContext as jest.Mock).mockImplementation(
            async (_req, _context, _options, callback) =>
                callback({
                    supabase: { from: jest.fn() },
                    admin: { from: jest.fn() },
                    bizId: 'biz-1',
                    staffId: 'staff-1',
                    staff: {
                        id: 'staff-1',
                        biz_id: 'biz-1',
                        percent_master: 60,
                        percent_salon: 40,
                        hourly_rate: 500,
                    },
                }),
        );
        (runDeprecatedStaffFinance as jest.Mock).mockResolvedValue({
            ok: false,
            status: 400,
            error: 'validation',
            message: 'Invalid query parameters',
        });

        const response = await runDeprecatedStaffFinanceHttp(req, context);
        const body = await response.json();

        expect(response.status).toBe(400);
        expect(body.error).toBe('validation');
    });
});
