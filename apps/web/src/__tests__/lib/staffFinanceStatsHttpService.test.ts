import { runStaffFinanceStatsHttp } from '@/lib/staffFinanceStatsHttpService';

jest.mock('@/lib/withManagerAndStaffContext', () => ({
    withManagerAndStaffContext: jest.fn(),
}));

jest.mock('@/lib/staffFinanceStatsService', () => ({
    runStaffFinanceStats: jest.fn(),
}));

jest.mock('@/lib/authBiz', () => ({
    getStaffContextForRequest: jest.fn(),
}));

jest.mock('@/lib/routeParams', () => ({
    getRouteParamUuid: jest.fn(),
}));

jest.mock('@/lib/supabaseService', () => ({
    getServiceClient: jest.fn(),
}));

import { getStaffContextForRequest } from '@/lib/authBiz';
import { getRouteParamUuid } from '@/lib/routeParams';
import { runStaffFinanceStats } from '@/lib/staffFinanceStatsService';
import { getServiceClient } from '@/lib/supabaseService';
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

    test('allows bearer-authenticated staff to load only their own stats', async () => {
        const admin = {
            from: jest.fn().mockReturnValue({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({
                    data: { id: 'staff-1', biz_id: 'biz-1', full_name: 'Ada' },
                    error: null,
                }),
            }),
        };
        (getRouteParamUuid as jest.Mock).mockResolvedValue('staff-1');
        (getStaffContextForRequest as jest.Mock).mockResolvedValue({
            supabase: { auth: { getUser: jest.fn() } },
            userId: 'user-1',
            staffId: 'staff-1',
            bizId: 'biz-1',
            branchId: null,
        });
        (getServiceClient as jest.Mock).mockReturnValue(admin);
        (runStaffFinanceStats as jest.Mock).mockResolvedValue({
            ok: true,
            stats: { shiftsCount: 2 },
        });

        const response = await runStaffFinanceStatsHttp(
            new Request('http://localhost/api/dashboard/staff/staff-1/finance/stats', {
                headers: { authorization: 'Bearer token' },
            }),
            { params: { id: 'staff-1' } },
        );
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.data.stats).toEqual({ shiftsCount: 2 });
        expect(runStaffFinanceStats).toHaveBeenCalledWith(
            expect.objectContaining({
                admin,
                bizId: 'biz-1',
                staffId: 'staff-1',
                staff: { full_name: 'Ada' },
            }),
        );
        expect(withManagerAndStaffContext).not.toHaveBeenCalled();
    });

    test('rejects bearer-authenticated staff requesting another staff id', async () => {
        (getRouteParamUuid as jest.Mock).mockResolvedValue('staff-2');
        (getStaffContextForRequest as jest.Mock).mockResolvedValue({
            supabase: {},
            userId: 'user-1',
            staffId: 'staff-1',
            bizId: 'biz-1',
            branchId: null,
        });

        const response = await runStaffFinanceStatsHttp(
            new Request('http://localhost/api/dashboard/staff/staff-2/finance/stats', {
                headers: { authorization: 'Bearer token' },
            }),
            { params: { id: 'staff-2' } },
        );
        const body = await response.json();

        expect(response.status).toBe(403);
        expect(body.error).toBe('forbidden');
        expect(runStaffFinanceStats).not.toHaveBeenCalled();
    });
});
